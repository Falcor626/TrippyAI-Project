import { supabase } from '../supabaseClient';
import { TRIPPY_API_BASE } from '../config';

export const generateItinerary = async (trip) => {
  const response = await fetch(`${TRIPPY_API_BASE}/generate-itinerary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trip }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Unable to generate itinerary.');
  }

  return {
    itinerary: data.itinerary,
  };
};

export const refineItinerary = async (trip, itinerary, instruction) => {
  const response = await fetch(`${TRIPPY_API_BASE}/refine-itinerary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trip, itinerary, instruction }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Unable to refine itinerary.');
  }

  return {
    itinerary: data.itinerary,
  };
};

export const sendTrippyChatMessage = async (message, history = [], trip = {}) => {
  const response = await fetch(`${TRIPPY_API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      questionnaireContext: {
        destination: trip.destination || '',
        departureCity: trip.departureCity || '',
        startDate: trip.startDate || '',
        endDate: trip.endDate || '',
        budget: trip.budget || '',
        interests: trip.interests || [],
        travelerCount: trip.travelerCount || 1,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Unable to reach Trippy right now.');
  }

  return data.reply || 'I am here to help with your trip.';
};

export const getCurrentItinerary = async (userId, tripRequestId) => {
  const { data, error } = await supabase
    .from('itineraries')
    .select('id, summary, itinerary_json, updated_at, created_at')
    .eq('trip_request_id', tripRequestId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
};

export const getItineraryVersions = async (userId, tripRequestId) => {
  const { data: itinerary, error: itineraryError } = await supabase
    .from('itineraries')
    .select('id')
    .eq('trip_request_id', tripRequestId)
    .eq('user_id', userId)
    .maybeSingle();

  if (itineraryError) {
    throw itineraryError;
  }

  if (!itinerary?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from('itinerary_versions')
    .select('id, version_number, itinerary_json, created_at')
    .eq('itinerary_id', itinerary.id)
    .order('version_number', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

export const getItineraryVersionById = async (userId, tripRequestId, versionId) => {
  if (!versionId) {
    throw new Error('Choose a version before restoring.');
  }

  const { data: itinerary, error: itineraryError } = await supabase
    .from('itineraries')
    .select('id')
    .eq('trip_request_id', tripRequestId)
    .eq('user_id', userId)
    .maybeSingle();

  if (itineraryError) {
    throw itineraryError;
  }

  if (!itinerary?.id) {
    throw new Error('No current itinerary record was found for this trip.');
  }

  const { data, error } = await supabase
    .from('itinerary_versions')
    .select('id, version_number, itinerary_json, created_at')
    .eq('id', versionId)
    .eq('itinerary_id', itinerary.id)
    .single();

  if (error) {
    throw error;
  }

  if (!data?.itinerary_json) {
    throw new Error('That saved version is missing itinerary data.');
  }

  return data;
};

const getOrCreateTripChatSession = async (userId, tripRequestId, planName = '') => {
  if (!userId || !tripRequestId) {
    throw new Error('A user and trip request are required to save Trippy chat history.');
  }

  const { data: existingSession, error: sessionFetchError } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('trip_request_id', tripRequestId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionFetchError) {
    throw sessionFetchError;
  }

  if (existingSession?.id) {
    return existingSession.id;
  }

  const { data: newSession, error: sessionInsertError } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      trip_request_id: tripRequestId,
      title: planName ? `${planName} Trippy chat` : 'Trip Trippy chat',
    })
    .select('id')
    .single();

  if (sessionInsertError) {
    throw sessionInsertError;
  }

  return newSession.id;
};

export const getTripChatMessages = async (userId, tripRequestId) => {
  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('trip_request_id', tripRequestId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('chat_session_id', session.id)
    .eq('user_id', userId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
};

export const appendTripChatMessage = async (userId, tripRequestId, planName, role, content) => {
  if (!content?.trim()) {
    return;
  }

  await saveTripChatMessages(userId, tripRequestId, planName, [{ role, content }]);
};

export const saveTripChatMessages = async (userId, tripRequestId, planName, messages = []) => {
  const normalizedMessages = messages
    .filter((message) => ['user', 'assistant'].includes(message?.role) && message?.content?.trim())
    .map((message, index) => ({
      role: message.role,
      content: message.content.trim(),
      created_at: new Date(Date.now() + index).toISOString(),
    }));

  if (!normalizedMessages.length) {
    return;
  }

  const sessionId = await getOrCreateTripChatSession(userId, tripRequestId, planName);

  const { error: messageError } = await supabase.from('chat_messages').insert(
    normalizedMessages.map((message) => ({
      chat_session_id: sessionId,
      user_id: userId,
      role: message.role,
      content: message.content,
      created_at: message.created_at,
    }))
  );

  if (messageError) {
    throw messageError;
  }

  const { error: sessionError } = await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (sessionError) {
    throw sessionError;
  }
};

const buildQuestionnaireSnapshot = (trip = {}) => ({
  planName: trip.planName || trip.destination || '',
  destination: trip.destination || '',
  departureCity: trip.departureCity || '',
  startDate: trip.startDate || '',
  endDate: trip.endDate || '',
  budget: trip.budget || '',
  interests: trip.interests || [],
  travelerCount: trip.travelerCount || 1,
});

const buildVersionSnapshot = (itinerary = {}, trip = {}) => ({
  ...itinerary,
  tripSnapshot: buildQuestionnaireSnapshot(trip),
});

const getItineraryDateRange = (itinerary = {}) => {
  const datedDays = Array.isArray(itinerary.days)
    ? itinerary.days
        .map((day) => day?.date)
        .filter((date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
    : [];

  if (!datedDays.length) {
    return {};
  }

  return {
    startDate: datedDays[0],
    endDate: datedDays[datedDays.length - 1],
  };
};

const getRestorableTripSnapshot = (itinerary = {}) => {
  const snapshot = {
    ...(itinerary.tripSnapshot || {}),
    ...(itinerary.questionnaire_data || {}),
  };
  const dateRange = getItineraryDateRange(itinerary);

  return {
    ...snapshot,
    startDate: snapshot.startDate || dateRange.startDate,
    endDate: snapshot.endDate || dateRange.endDate,
  };
};

export const saveItinerary = async (userId, tripRequestId, itinerary, trip = {}) => {
  const itineraryMeta = {
    plan_name: trip.planName || itinerary.title || trip.destination || null,
    questionnaire_data: buildQuestionnaireSnapshot(trip),
    travelers: Number(trip.travelerCount) || 1,
  };

  const { data: existingItinerary, error: fetchError } = await supabase
    .from('itineraries')
    .select('id, questionnaire_data, travelers, plan_name')
    .eq('trip_request_id', tripRequestId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  let itineraryId = existingItinerary?.id || null;
  let versionNumber = 1;

  if (itineraryId) {
    const { data: latestVersion, error: versionError } = await supabase
      .from('itinerary_versions')
      .select('version_number')
      .eq('itinerary_id', itineraryId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError && versionError.code !== 'PGRST116') {
      throw versionError;
    }

    versionNumber = (latestVersion?.version_number || 0) + 1;

    const { error: updateError } = await supabase
      .from('itineraries')
      .update({
        summary: itinerary.summary || null,
        itinerary_json: itinerary,
        ...itineraryMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itineraryId)
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }
  } else {
    const { data: newItinerary, error: insertError } = await supabase
      .from('itineraries')
      .insert({
        trip_request_id: tripRequestId,
        user_id: userId,
        summary: itinerary.summary || null,
        itinerary_json: itinerary,
        ...itineraryMeta,
      })
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    itineraryId = newItinerary.id;
  }

  const { data: versionData, error: versionInsertError } = await supabase
    .from('itinerary_versions')
    .insert({
      itinerary_id: itineraryId,
      version_number: versionNumber,
      itinerary_json: buildVersionSnapshot(itinerary, trip),
    })
    .select()
    .single();

  if (versionInsertError) {
    throw versionInsertError;
  }

  return versionData;
};

export const restoreItinerarySnapshot = async (userId, tripRequestId, itinerary, trip = {}) => {
  const restoredTripSnapshot = getRestorableTripSnapshot(itinerary);
  const itineraryMeta = {
    plan_name:
      restoredTripSnapshot.planName ||
      trip.planName ||
      itinerary.title ||
      restoredTripSnapshot.destination ||
      trip.destination ||
      null,
    questionnaire_data: {
      ...buildQuestionnaireSnapshot(trip),
      ...restoredTripSnapshot,
    },
    travelers: Number(restoredTripSnapshot.travelerCount || trip.travelerCount) || 1,
  };

  const { data: existingItinerary, error: fetchError } = await supabase
    .from('itineraries')
    .select('id, questionnaire_data, travelers, plan_name')
    .eq('trip_request_id', tripRequestId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!existingItinerary?.id) {
    throw new Error('No current itinerary record was found to restore.');
  }

  const fallbackSnapshot = {
    ...(existingItinerary.questionnaire_data || {}),
    planName: existingItinerary.questionnaire_data?.planName || existingItinerary.plan_name || trip.planName,
    travelerCount:
      existingItinerary.questionnaire_data?.travelerCount ||
      existingItinerary.travelers ||
      trip.travelerCount,
  };
  const tripSnapshot = {
    ...buildQuestionnaireSnapshot(trip),
    ...fallbackSnapshot,
    ...restoredTripSnapshot,
  };

  const { data, error } = await supabase
    .from('itineraries')
    .update({
      summary: itinerary.summary || null,
      itinerary_json: itinerary,
      ...itineraryMeta,
      questionnaire_data: tripSnapshot,
      travelers: Number(tripSnapshot.travelerCount) || itineraryMeta.travelers,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingItinerary.id)
    .eq('user_id', userId)
    .select('id, summary, itinerary_json, questionnaire_data, travelers, plan_name, updated_at, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const renameTripPlan = async (userId, tripRequestId, planName) => {
  const trimmedPlanName = planName?.trim();

  if (!trimmedPlanName) {
    throw new Error('Enter a trip name before saving.');
  }

  const { data: tripRow, error: tripError } = await supabase
    .from('trip_requests')
    .update({ plan_name: trimmedPlanName })
    .eq('id', tripRequestId)
    .eq('user_id', userId)
    .select()
    .single();

  if (tripError) {
    throw tripError;
  }

  const { data: existingItinerary, error: itineraryFetchError } = await supabase
    .from('itineraries')
    .select('id')
    .eq('trip_request_id', tripRequestId)
    .eq('user_id', userId)
    .maybeSingle();

  if (itineraryFetchError) {
    throw itineraryFetchError;
  }

  let currentItinerary = null;

  if (existingItinerary?.id) {
    const { data: itineraryRow, error: itineraryUpdateError } = await supabase
      .from('itineraries')
      .update({
        plan_name: trimmedPlanName,
      })
      .eq('id', existingItinerary.id)
      .eq('user_id', userId)
      .select('id, plan_name, updated_at')
      .single();

    if (itineraryUpdateError) {
      throw itineraryUpdateError;
    }

    currentItinerary = itineraryRow;
  }

  return {
    tripRow,
    itineraryRow: currentItinerary,
  };
};
