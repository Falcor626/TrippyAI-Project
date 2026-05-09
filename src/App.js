import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import tripaiLogo from './assets/TripAI_Logo.png';
import Login from './Components/login';
import SignUp from './Components/signUp';
import Settings from './Components/Settings';
import ProfileSettings from './Components/ProfileSettings';
import MainMenu from './Components/MainMenu';
import ResetPassword from './Components/ResetPassword';
import Questionnaire from './Components/Questionnaire';
import ViewPlans from './Components/ViewPlans';
import TravelItinerary from './Components/TravelItinerary';
import {
  appendTripChatMessage,
  generateItinerary,
  getCurrentItinerary,
  getItineraryVersionById,
  getTripChatMessages,
  getItineraryVersions,
  refineItinerary,
  renameTripPlan,
  restoreItinerarySnapshot,
  saveItinerary,
  saveTripChatMessages,
} from './services/itineraryService';

const emptyQuestionnaire = {
  destination: '',
  departureCity: '',
  startDate: '',
  endDate: '',
  budget: '',
  interests: [],
};

function mapTripRowToForm(row) {
  return {
    id: row.id,
    planName: row.plan_name || row.destination || '',
    travelerCount: row.traveler_count || 1,
    destination: row.destination || '',
    departureCity: row.departure_city || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    budget: row.budget_range || '',
    interests: row.interests || [],
    status: row.status || 'pending',
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
  };
}

function isItineraryJsonError(error) {
  const message = error?.message || '';
  return [
    "Expecting ',' delimiter",
    'Trippy could not format the itinerary response',
    'invalid itinerary JSON',
    'JSONDecodeError',
    'Unterminated',
    'Extra data',
    'incomplete itinerary',
    "I couldn't fully update the itinerary",
  ].some((fragment) => message.includes(fragment));
}

function buildChangeSummaryFromInstruction(instruction = '') {
  const normalized = instruction.trim().toLowerCase();

  if (!normalized) {
    return 'Updated Itinerary';
  }

  if (/(cheap|cost|budget|save|less expensive|affordable)/.test(normalized)) {
    return 'Cheaper Plan';
  }

  if (/(relax|calm|slower|slow|less busy|easy|pace)/.test(normalized)) {
    return 'More Relaxed Pace';
  }

  if (/(food|restaurant|eat|dining|meal|drink)/.test(normalized)) {
    return 'Food-Focused';
  }

  if (/(romantic|romance)/.test(normalized) && /(anime|anime-filled)/.test(normalized)) {
    return 'Romantic + Anime Focus';
  }

  if (/(romantic|romance)/.test(normalized)) {
    return 'Romantic Focus';
  }

  if (/(anime|anime-filled)/.test(normalized)) {
    return 'Anime Focus';
  }

  if (/(kid|child|children|family)/.test(normalized)) {
    return 'Family-Friendly';
  }

  if (/(adventure|hike|outdoor|active)/.test(normalized)) {
    return 'Adventure-Focused';
  }

  return 'Updated Itinerary';
}

function getTripMetaCache(tripId) {
  if (!tripId || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`trippy.tripMeta.${tripId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('[getTripMetaCache] Error:', error.message);
    return null;
  }
}

function setTripMetaCache(tripId, meta) {
  if (!tripId || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`trippy.tripMeta.${tripId}`, JSON.stringify(meta));
  } catch (error) {
    console.warn('[setTripMetaCache] Error:', error.message);
  }
}

function enrichTripWithMeta(trip) {
  if (!trip) {
    return trip;
  }

  const cachedMeta = getTripMetaCache(trip.id) || {};

  return {
    ...trip,
    planName: trip.planName || cachedMeta.planName || trip.destination || '',
    travelerCount: trip.travelerCount || cachedMeta.travelerCount || 1,
  };
}

function isPasswordRecoveryUrl() {
  if (typeof window === 'undefined') {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  return (
    searchParams.get('reset-password') === '1' ||
    searchParams.get('type') === 'recovery' ||
    hashParams.get('type') === 'recovery'
  );
}

function App() {
  const initializedUserIdRef = useRef(null);
  const [showLogin, setShowLogin] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [showSavedTrips, setShowSavedTrips] = useState(false);
  const [questionnaireMode, setQuestionnaireMode] = useState('trip');
  const [questionnaireDefaults, setQuestionnaireDefaults] = useState(emptyQuestionnaire);
  const [questionnaireError, setQuestionnaireError] = useState('');
  const [isSubmittingQuestionnaire, setIsSubmittingQuestionnaire] = useState(false);
  const [isRegeneratingItinerary, setIsRegeneratingItinerary] = useState(false);
  const [isRefiningItinerary, setIsRefiningItinerary] = useState(false);
  const [isRestoringItineraryVersion, setIsRestoringItineraryVersion] = useState(false);
  const [isRenamingTrip, setIsRenamingTrip] = useState(false);
  const [isLoadingItineraryVersions, setIsLoadingItineraryVersions] = useState(false);
  const [isLoadingTripChat, setIsLoadingTripChat] = useState(false);
  const [itineraryVersions, setItineraryVersions] = useState([]);
  const [activeVersionId, setActiveVersionId] = useState('');
  const [itineraryVersionsError, setItineraryVersionsError] = useState('');
  const [tripChatMessages, setTripChatMessages] = useState([]);
  const [tripChatError, setTripChatError] = useState('');
  const [activeTrip, setActiveTrip] = useState(null);
  const [editingTripId, setEditingTripId] = useState(null);
  const [editingTripChatBaseCount, setEditingTripChatBaseCount] = useState(0);
  const homeIsActive =
    isLoggedIn &&
    !showSettings &&
    !showProfile &&
    !showQuestionnaire &&
    !showSavedTrips &&
    !activeTrip;
  const savedTripsIsActive = showSavedTrips && !showSettings && !showProfile;

  const resolveAvatarUrl = (value) => {
    if (!value || typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    const normalizedPath = trimmed
      .replace(/^\/+/, '')
      .replace(/^profile-pictures\//, '');

    const { data } = supabase.storage.from('profile-pictures').getPublicUrl(normalizedPath);
    return data?.publicUrl || null;
  };

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode && JSON.parse(savedDarkMode)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const recoveryUrl = isPasswordRecoveryUrl();

    if (recoveryUrl) {
      setShowResetPassword(true);
      setShowLogin(true);
      setShowSettings(false);
      setShowProfile(false);
      setShowQuestionnaire(false);
      setShowSavedTrips(false);
      setActiveTrip(null);
      setActiveVersionId('');
      setIsInitializing(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
        setShowLogin(true);
        setShowSettings(false);
        setShowProfile(false);
        setShowQuestionnaire(false);
        setShowSavedTrips(false);
        setActiveTrip(null);
        setActiveVersionId('');
        setIsLoggedIn(false);
        setIsInitializing(false);
        return;
      }

      if (recoveryUrl) {
        setIsInitializing(false);
        return;
      }

      // Ignore background auth events that should not change app routing.
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (isInitializing) {
          setIsInitializing(false);
        }
        return;
      }

      if (session?.user) {
        // Avoid duplicate initialization for the same user from repeated auth events.
        if (initializedUserIdRef.current !== session.user.id) {
          await initializeUserState(session.user);
          initializedUserIdRef.current = session.user.id;
        }
      } else {
        initializedUserIdRef.current = null;
        resetToLoggedOutState();
      }

      setIsInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleForm = () => {
    setShowLogin((prev) => !prev);
  };

  const toggleSettings = () => {
    setShowSettings((prev) => {
      const next = !prev;

      if (next) {
        setShowProfile(false);
      }

      return next;
    });
  };

  const toggleProfile = () => {
    setShowProfile((prev) => {
      const next = !prev;

      if (next) {
        setShowSettings(false);
      }

      return next;
    });
  };

  const resetToLoggedOutState = () => {
    setIsLoggedIn(false);
    setShowLogin(true);
    setShowSettings(false);
    setShowProfile(false);
    setShowQuestionnaire(false);
    setShowSavedTrips(false);
    setQuestionnaireMode('trip');
    setQuestionnaireDefaults(emptyQuestionnaire);
    setQuestionnaireError('');
    setAvatarUrl(null);
    setActiveTrip(null);
    setItineraryVersions([]);
    setActiveVersionId('');
    setItineraryVersionsError('');
    setTripChatMessages([]);
    setTripChatError('');
    setIsLoadingTripChat(false);
    setEditingTripId(null);
    setEditingTripChatBaseCount(0);
  };

  const ensureUserProfileRow = async (user) => {
    const profileSeed = {
      id: user.id,
      user_name: user.user_metadata?.username || null,
      full_name: user.user_metadata?.full_name || null,
    };

    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      const upsertPromise = supabase.from('userProfiles').upsert(profileSeed, { onConflict: 'id' });

      await Promise.race([upsertPromise, timeoutPromise]);
    } catch (error) {
      console.warn('[ensureUserProfileRow] Error (non-blocking):', error.message);
      // Non-critical operation - continue even if it fails
    }
  };

  const loadUserProfile = async (userId) => {
    const fetchAvatar = async (withTimeout = true) => {
      const selectPromise = supabase.from('userProfiles').select('avatar_url').eq('id', userId).maybeSingle();

      if (!withTimeout) {
        return selectPromise;
      }

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      return Promise.race([selectPromise, timeoutPromise]);
    };

    try {
      const result = await fetchAvatar(true);
      const { data: profile, error } = result;

      if (error) {
        console.warn('[loadUserProfile] Error (non-blocking):', error.message);
        return;
      }

      setAvatarUrl(resolveAvatarUrl(profile?.avatar_url));
    } catch (error) {
      console.warn('[loadUserProfile] Error (non-blocking):', error.message);

      // Retry once in the background without timeout to recover from temporary latency spikes.
      setTimeout(async () => {
        try {
          const retryResult = await fetchAvatar(false);
          if (retryResult?.error) {
            return;
          }

          setAvatarUrl(resolveAvatarUrl(retryResult?.data?.avatar_url));
        } catch (retryError) {
          console.warn('[loadUserProfile] Retry failed:', retryError.message);
        }
      }, 1200);
    }
  };

  const getQuestionnaireDefaults = async (userId) => {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));

      const selectPromise = supabase
        .from('traveler_preferences')
        .select('preferred_departure_city, preferred_budget, preferred_interests')
        .eq('user_id', userId)
        .maybeSingle();

      const result = await Promise.race([selectPromise, timeoutPromise]);
      const { data: preferences, error } = result;

      if (error) {
        console.warn('[getQuestionnaireDefaults] Error (non-critical):', error.message);
        return { defaults: emptyQuestionnaire, hasPreferences: false, resolved: false };
      }

      const hasPreferences = Boolean(
        preferences?.preferred_departure_city ||
          preferences?.preferred_budget ||
          (preferences?.preferred_interests && preferences.preferred_interests.length > 0)
      );

      return {
        hasPreferences,
        resolved: true,
        defaults: {
          ...emptyQuestionnaire,
          departureCity: preferences?.preferred_departure_city || '',
          budget: preferences?.preferred_budget || '',
          interests: preferences?.preferred_interests || [],
        },
      };
    } catch (error) {
      console.warn('[getQuestionnaireDefaults] Error (non-critical):', error.message);
      return { defaults: emptyQuestionnaire, hasPreferences: false, resolved: false };
    }
  };

  const userHasSavedTrips = async (userId) => {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));

      const selectPromise = supabase
        .from('trip_requests')
        .select('id')
        .eq('user_id', userId)
        .neq('status', 'deleted')
        .limit(1);

      const result = await Promise.race([selectPromise, timeoutPromise]);
      const { data, error } = result;

      if (error) {
        console.warn('[userHasSavedTrips] Error (non-critical):', error.message);
        return { hasTrips: false, resolved: false };
      }

      return { hasTrips: Array.isArray(data) && data.length > 0, resolved: true };
    } catch (error) {
      console.warn('[userHasSavedTrips] Error (non-critical):', error.message);
      return { hasTrips: false, resolved: false };
    }
  };

  const initializeUserState = async (user) => {
    setIsLoggedIn(true);
    setShowLogin(true);
    setQuestionnaireError('');
    setActiveTrip(null);
    setItineraryVersions([]);
    setActiveVersionId('');
    setItineraryVersionsError('');
    setTripChatMessages([]);
    setTripChatError('');
    setIsLoadingTripChat(false);
    setEditingTripId(null);
    setEditingTripChatBaseCount(0);

    try {
      // Safety timeout: if initialization takes longer than 15 seconds, proceed anyway
      const initPromise = Promise.all([
        ensureUserProfileRow(user),
        loadUserProfile(user.id),
        getQuestionnaireDefaults(user.id),
        userHasSavedTrips(user.id),
      ]);

      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => {
          console.warn('[initializeUserState] Initialization timeout - proceeding with defaults');
          resolve([
            undefined,
            undefined,
            { defaults: emptyQuestionnaire, hasPreferences: false, resolved: false },
            { hasTrips: false, resolved: false },
          ]);
        }, 15000)
      );

      const [, , questionnaireResult, tripCheckResult] = await Promise.race([initPromise, timeoutPromise]);

      const { defaults, hasPreferences, resolved: preferencesResolved } = questionnaireResult;
      const { hasTrips, resolved: tripsResolved } = tripCheckResult;
      setQuestionnaireDefaults(defaults);

      // Only show onboarding when both checks completed successfully and confirm the user is new.
      const shouldShowOnboarding = preferencesResolved && tripsResolved && !hasPreferences && !hasTrips;

      if (shouldShowOnboarding) {
        setQuestionnaireMode('onboarding');
        setShowQuestionnaire(true);
        setShowSavedTrips(false);
      } else {
        setShowQuestionnaire(false);
        setShowSavedTrips(false);
        setQuestionnaireMode('trip');
      }
    } catch (error) {
      console.error('[initializeUserState] Unexpected error:', error);
      // Fallback: show main menu
      setShowQuestionnaire(false);
      setShowSavedTrips(false);
      setQuestionnaireMode('trip');
    }
  };

  const handleLogin = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setIsLoggedIn(true);
      setShowLogin(true);
    }
  };

  const onAvatarUpdate = (newAvatarUrl) => {
    setAvatarUrl(resolveAvatarUrl(newAvatarUrl));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    resetToLoggedOutState();
  };

  const handleResetComplete = async () => {
    await supabase.auth.signOut();
    setShowResetPassword(false);
    setShowLogin(true);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleViewPlans = () => {
    setActiveTrip(null);
    setItineraryVersions([]);
    setActiveVersionId('');
    setItineraryVersionsError('');
    setTripChatMessages([]);
    setTripChatError('');
    setIsLoadingTripChat(false);
    setEditingTripId(null);
    setShowSavedTrips(true);
    setShowQuestionnaire(false);
    setShowProfile(false);
    setShowSettings(false);
  };

  const handleGoToMainMenu = () => {
    setActiveTrip(null);
    setItineraryVersions([]);
    setActiveVersionId('');
    setItineraryVersionsError('');
    setTripChatMessages([]);
    setTripChatError('');
    setIsLoadingTripChat(false);
    setEditingTripId(null);
    setShowQuestionnaire(false);
    setShowSavedTrips(false);
    setShowProfile(false);
    setShowSettings(false);
    setQuestionnaireError('');
    setQuestionnaireMode('trip');
  };

  const handleStartPlan = async (tripToEdit = null) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setQuestionnaireError('Please log in again before starting a trip.');
      setIsLoggedIn(false);
      return;
    }

    if (tripToEdit) {
      const cachedMeta = getTripMetaCache(tripToEdit.id) || {};
      setEditingTripId(tripToEdit.id || null);
      setQuestionnaireDefaults({
        planName: tripToEdit.planName || cachedMeta.planName || '',
        travelerCount: tripToEdit.travelerCount || cachedMeta.travelerCount || 1,
        destination: tripToEdit.destination || '',
        departureCity: tripToEdit.departureCity || '',
        startDate: tripToEdit.startDate || '',
        endDate: tripToEdit.endDate || '',
        budget: tripToEdit.budget || '',
        interests: tripToEdit.interests || [],
      });
      const existingChatMessages = await loadTripChatMessages(tripToEdit.id);
      setEditingTripChatBaseCount(existingChatMessages.length);
    } else {
      const { defaults } = await getQuestionnaireDefaults(user.id);
      setQuestionnaireDefaults(defaults);
      setEditingTripId(null);
      setEditingTripChatBaseCount(0);
      setTripChatMessages([]);
      setTripChatError('');
      setIsLoadingTripChat(false);
    }

    setQuestionnaireMode('trip');
    setQuestionnaireError('');
    setShowSavedTrips(false);
    setShowProfile(false);
    setShowSettings(false);
    setActiveTrip(null);
    setItineraryVersions([]);
    setActiveVersionId('');
    setItineraryVersionsError('');
    setShowQuestionnaire(true);
  };

  const loadTripChatMessages = async (tripId) => {
    if (!tripId) {
      setTripChatMessages([]);
      setTripChatError('');
      return [];
    }

    setIsLoadingTripChat(true);
    setTripChatError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in again before loading Trippy chat history.');
      }

      const messages = await getTripChatMessages(user.id, tripId);
      setTripChatMessages(messages);
      return messages;
    } catch (error) {
      console.warn('Unable to load Trippy trip chat:', error.message);
      setTripChatMessages([]);
      setTripChatError(error?.message || 'Unable to load Trippy chat history.');
      return [];
    } finally {
      setIsLoadingTripChat(false);
    }
  };

  const loadItineraryVersions = async (tripId) => {
    if (!tripId) {
      setItineraryVersions([]);
      setActiveVersionId('');
      setItineraryVersionsError('');
      return [];
    }

    setIsLoadingItineraryVersions(true);
    setItineraryVersionsError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in again before loading version history.');
      }

      const versions = await getItineraryVersions(user.id, tripId);
      setItineraryVersions(versions);
      setActiveVersionId(versions[0]?.id || '');
      return versions;
    } catch (error) {
      console.warn('Unable to load itinerary versions:', error.message);
      setItineraryVersions([]);
      setActiveVersionId('');
      setItineraryVersionsError(error?.message || 'Unable to load itinerary version history.');
      return [];
    } finally {
      setIsLoadingItineraryVersions(false);
    }
  };

  const handleQuestionnaireSubmit = async (formData, planningChatMessages = []) => {
    setIsSubmittingQuestionnaire(true);
    setQuestionnaireError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('You need to be logged in to save trip preferences.');
      }

      const now = new Date().toISOString();

      const tripRecord = {
        plan_name: formData.planName,
        traveler_count: formData.travelerCount,
        destination: formData.destination,
        departure_city: formData.departureCity,
        start_date: formData.startDate,
        end_date: formData.endDate,
        budget_range: formData.budget,
        interests: formData.interests,
        status: 'generated',
        updated_at: now,
      };

      const { error: preferencesError } = await supabase.from('traveler_preferences').upsert(
        {
          user_id: user.id,
          preferred_departure_city: formData.departureCity,
          preferred_budget: formData.budget,
          preferred_interests: formData.interests,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      );

      if (preferencesError) {
        throw preferencesError;
      }

      let savedTripRow;
      const isEditingExistingTrip = Boolean(editingTripId);

      if (isEditingExistingTrip) {
        const { data, error: tripRequestError } = await supabase
          .from('trip_requests')
          .update(tripRecord)
          .eq('id', editingTripId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (tripRequestError) {
          throw tripRequestError;
        }

        savedTripRow = data;
      } else {
        const { data, error: tripRequestError } = await supabase
          .from('trip_requests')
          .insert({
            user_id: user.id,
            ...tripRecord,
          })
          .select()
          .single();

        if (tripRequestError) {
          throw tripRequestError;
        }

        savedTripRow = data;
      }

      setQuestionnaireDefaults({
        ...emptyQuestionnaire,
        departureCity: formData.departureCity,
        budget: formData.budget,
        interests: formData.interests,
      });
      setQuestionnaireMode('trip');
      const savedTrip = enrichTripWithMeta({
        ...mapTripRowToForm(savedTripRow),
        planName: formData.planName || savedTripRow?.plan_name || formData.destination,
        travelerCount: formData.travelerCount || savedTripRow?.traveler_count || 1,
      });

      setTripMetaCache(savedTrip.id, {
        planName: savedTrip.planName,
        travelerCount: savedTrip.travelerCount,
      });

      const transferableChatMessages = planningChatMessages.filter(
        (message) => ['user', 'assistant'].includes(message?.role) && message?.content?.trim()
      );
      const chatMessagesToPersist = isEditingExistingTrip
        ? transferableChatMessages.slice(editingTripChatBaseCount)
        : [];

      if (isEditingExistingTrip) {
        try {
          await saveTripChatMessages(user.id, savedTrip.id, savedTrip.planName, chatMessagesToPersist);
          setTripChatMessages(transferableChatMessages);
          setTripChatError('');
        } catch (chatError) {
          console.warn('Unable to save planning Trippy chat:', chatError.message);
          setTripChatMessages(transferableChatMessages);
          setTripChatError('Trip saved, but Trippy chat history could not be saved.');
        } finally {
          setIsLoadingTripChat(false);
        }
      } else {
        setTripChatMessages([]);
        setTripChatError('');
        setIsLoadingTripChat(false);
      }

      setActiveTrip({
        ...savedTrip,
        itinerary: null,
        itineraryStatus: 'generating',
        itineraryError: '',
      });
      setShowQuestionnaire(false);
      setShowSavedTrips(false);
      setEditingTripId(null);
      setEditingTripChatBaseCount(0);

      if (isEditingExistingTrip) {
        const currentItinerary = await getCurrentItinerary(user.id, savedTrip.id);
        await loadItineraryVersions(savedTrip.id);
        setActiveTrip({
          ...savedTrip,
          itinerary: currentItinerary?.itinerary_json || null,
          itineraryStatus: currentItinerary?.itinerary_json ? 'generated' : 'failed',
          itineraryError: currentItinerary?.itinerary_json
            ? ''
            : 'Trip details were updated, but no saved itinerary was found.',
        });
        return;
      }

      try {
        const { itinerary } = await generateItinerary(savedTrip);
        await saveItinerary(user.id, savedTrip.id, itinerary, savedTrip);
        await loadItineraryVersions(savedTrip.id);
        setActiveTrip({
          ...savedTrip,
          itinerary,
          itineraryStatus: 'generated',
        });
      } catch (generationError) {
        console.error('Itinerary generation error:', generationError);
        try {
          await supabase
            .from('trip_requests')
            .update({ status: 'generation_failed', updated_at: new Date().toISOString() })
            .eq('id', savedTrip.id)
            .eq('user_id', user.id);
        } catch (statusError) {
          console.warn('Unable to mark trip generation as failed:', statusError.message);
        }

        setActiveTrip({
          ...savedTrip,
          status: 'generation_failed',
          itinerary: null,
          itineraryStatus: 'failed',
          itineraryError:
            generationError?.message ||
            'Trip request saved, but the AI itinerary could not be generated right now.',
        });
      }
    } catch (error) {
      console.error('Questionnaire submit error:', error);
      setQuestionnaireError(error?.message || 'Failed to save your questionnaire.');
    } finally {
      setIsSubmittingQuestionnaire(false);
    }
  };

  const handleSelectTrip = async (trip) => {
    const selectedTrip = enrichTripWithMeta(trip);
    setActiveTrip(selectedTrip);
    setItineraryVersions([]);
    setActiveVersionId('');
    setItineraryVersionsError('');
    setTripChatMessages([]);
    setTripChatError('');
    setShowSavedTrips(false);
    setShowQuestionnaire(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !selectedTrip?.id) {
        return;
      }

      const currentItinerary = await getCurrentItinerary(user.id, selectedTrip.id);
      await Promise.all([
        loadItineraryVersions(selectedTrip.id),
        loadTripChatMessages(selectedTrip.id),
      ]);
      if (currentItinerary?.itinerary_json) {
        setActiveTrip((prev) =>
          prev?.id === selectedTrip.id
            ? {
                ...prev,
                itinerary: currentItinerary.itinerary_json,
                itineraryStatus: 'generated',
                itineraryError: '',
              }
            : prev
        );
      } else {
        setActiveTrip((prev) =>
          prev?.id === selectedTrip.id
            ? {
                ...prev,
                itinerary: null,
                itineraryStatus: 'failed',
                itineraryError: 'No saved itinerary was found for this trip.',
              }
            : prev
        );
      }
    } catch (error) {
      console.warn('Unable to load saved itinerary:', error.message);
      setActiveTrip((prev) =>
        prev?.id === selectedTrip.id
          ? {
              ...prev,
              itineraryStatus: prev.itinerary ? 'generated' : 'failed',
              itineraryError: prev.itinerary ? '' : 'Unable to load the saved itinerary right now.',
            }
          : prev
      );
    }
  };

  const handleRegenerateItinerary = async () => {
    if (!activeTrip?.id || isRegeneratingItinerary) {
      return;
    }

    setIsRegeneratingItinerary(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in again before regenerating this itinerary.');
      }

      const { itinerary } = await generateItinerary(activeTrip);
      await saveItinerary(user.id, activeTrip.id, itinerary, activeTrip);
      await loadItineraryVersions(activeTrip.id);

      const now = new Date().toISOString();
      const { error: tripUpdateError } = await supabase
        .from('trip_requests')
        .update({ status: 'regenerated', updated_at: now })
        .eq('id', activeTrip.id)
        .eq('user_id', user.id);

      if (tripUpdateError) {
        throw tripUpdateError;
      }

      setActiveTrip((prev) => ({
        ...prev,
        itinerary,
        itineraryStatus: 'generated',
        itineraryError: '',
        status: 'regenerated',
        updatedAt: now,
      }));
    } catch (error) {
      console.error('Regenerate itinerary error:', error);
      setActiveTrip((prev) => ({
        ...prev,
        itineraryStatus: 'failed',
        itineraryError: error?.message || 'Unable to regenerate this itinerary right now.',
      }));
    } finally {
      setIsRegeneratingItinerary(false);
    }
  };

  const refineItineraryForTrip = async (tripForRefinement, instruction, user) => {
    const refinedResult = await refineItinerary(tripForRefinement, tripForRefinement.itinerary, instruction);
    const itinerary = {
      ...refinedResult.itinerary,
      changeSummary: refinedResult.itinerary.changeSummary || buildChangeSummaryFromInstruction(instruction),
    };

    await saveItinerary(user.id, tripForRefinement.id, itinerary, tripForRefinement);
    await loadItineraryVersions(tripForRefinement.id);

    const now = new Date().toISOString();
    const { error: tripUpdateError } = await supabase
      .from('trip_requests')
      .update({ status: 'refined', updated_at: now })
      .eq('id', tripForRefinement.id)
      .eq('user_id', user.id);

    if (tripUpdateError) {
      throw tripUpdateError;
    }

    const updatedTrip = {
      ...tripForRefinement,
      itinerary,
      itineraryStatus: 'generated',
      itineraryError: '',
      status: 'refined',
      updatedAt: now,
    };

    setActiveTrip((prev) => (
      prev?.id === tripForRefinement.id
        ? {
            ...prev,
            ...updatedTrip,
          }
        : prev
    ));

    return itinerary;
  };

  const handleRefineItinerary = async (instruction) => {
    const trimmedInstruction = instruction?.trim();

    if (!activeTrip?.id || !trimmedInstruction || isRefiningItinerary) {
      return null;
    }

    if (!activeTrip.itinerary) {
      throw new Error('Generate an itinerary before asking Trippy to refine it.');
    }

    setIsRefiningItinerary(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in again before refining this itinerary.');
      }

      try {
        return await refineItineraryForTrip(activeTrip, trimmedInstruction, user);
      } catch (error) {
        if (!isItineraryJsonError(error)) {
          throw error;
        }

        console.warn('Itinerary refinement returned invalid or incomplete JSON.', error);
        throw new Error("I couldn't fully update the itinerary. Please try again.");
      }
    } finally {
      setIsRefiningItinerary(false);
    }
  };

  const updateTripMetadataForTrip = async (tripToUpdate, changes = {}, user) => {
    const now = new Date().toISOString();
    const updatePayload = {
      updated_at: now,
    };

    if (changes.travelerCount != null) {
      updatePayload.traveler_count = Math.max(1, Number(changes.travelerCount) || 1);
    }

    if (changes.startDate) {
      updatePayload.start_date = changes.startDate;
    }

    if (changes.endDate) {
      updatePayload.end_date = changes.endDate;
    }

    if (changes.budget) {
      updatePayload.budget_range = changes.budget;
    }

    if (Array.isArray(changes.interests)) {
      updatePayload.interests = changes.interests;
    }

    if (changes.destination) {
      updatePayload.destination = changes.destination;
    }

    if (changes.departureCity) {
      updatePayload.departure_city = changes.departureCity;
    }

    const { data, error } = await supabase
      .from('trip_requests')
      .update(updatePayload)
      .eq('id', tripToUpdate.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const updatedTrip = enrichTripWithMeta({
      ...tripToUpdate,
      ...mapTripRowToForm(data),
      itinerary: tripToUpdate.itinerary,
      itineraryStatus: tripToUpdate.itineraryStatus || 'generated',
      itineraryError: tripToUpdate.itineraryError || '',
      updatedAt: now,
    });

    setTripMetaCache(updatedTrip.id, {
      planName: updatedTrip.planName,
      travelerCount: updatedTrip.travelerCount,
    });

    setActiveTrip(updatedTrip);
    return updatedTrip;
  };

  const handleUpdateTripMetadataAndRegenerate = async (changes = {}, instruction = '') => {
    if (!activeTrip?.id || !Object.keys(changes).length) {
      return { updatedTrip: activeTrip, regenerated: false };
    }

    setIsRefiningItinerary(true);
    let updatedTrip = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in again before updating trip details.');
      }

      updatedTrip = await updateTripMetadataForTrip(activeTrip, changes, user);
      const generationTrip = {
        ...updatedTrip,
        itinerary: updatedTrip.itinerary,
        metadataUpdateInstruction: instruction,
      };
      const { itinerary: generatedItinerary } = await generateItinerary(generationTrip);
      const itinerary = {
        ...generatedItinerary,
        changeSummary: generatedItinerary.changeSummary || buildChangeSummaryFromInstruction(instruction),
      };

      await saveItinerary(user.id, updatedTrip.id, itinerary, updatedTrip);
      await loadItineraryVersions(updatedTrip.id);

      const now = new Date().toISOString();
      const { error: tripUpdateError } = await supabase
        .from('trip_requests')
        .update({ status: 'refined', updated_at: now })
        .eq('id', updatedTrip.id)
        .eq('user_id', user.id);

      if (tripUpdateError) {
        throw tripUpdateError;
      }

      const regeneratedTrip = {
        ...updatedTrip,
        itinerary,
        itineraryStatus: 'generated',
        itineraryError: '',
        status: 'refined',
        updatedAt: now,
      };

      setActiveTrip((prev) => (
        prev?.id === updatedTrip.id
          ? {
              ...prev,
              ...regeneratedTrip,
            }
          : prev
      ));

      return { updatedTrip: regeneratedTrip, regenerated: true };
    } catch (error) {
      if (!updatedTrip) {
        throw error;
      }

      console.warn('Trip metadata updated, but itinerary regeneration failed:', error);
      setActiveTrip((prev) => (
        prev?.id === updatedTrip.id
          ? {
              ...prev,
              itineraryStatus: 'failed',
              itineraryError: 'Trip details were updated, but itinerary regeneration failed. Your dates and traveler count were saved.',
            }
          : prev
      ));
      return { updatedTrip, regenerated: false };
    } finally {
      setIsRefiningItinerary(false);
    }
  };

  const handleAppendTripChatMessage = async (message) => {
    if (!activeTrip?.id || !message?.content?.trim()) {
      return;
    }

    const normalizedMessage = {
      role: message.role,
      content: message.content.trim(),
    };

    setTripChatMessages((prev) => [...prev, normalizedMessage]);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Please log in again before saving Trippy chat history.');
    }

    await appendTripChatMessage(
      user.id,
      activeTrip.id,
      activeTrip.planName || activeTrip.destination,
      normalizedMessage.role,
      normalizedMessage.content
    );
  };

  const handleRenameTrip = async (nextPlanName) => {
    const trimmedPlanName = nextPlanName?.trim();

    if (!activeTrip?.id || !trimmedPlanName || isRenamingTrip) {
      return null;
    }

    setIsRenamingTrip(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in again before renaming this trip.');
      }

      const { tripRow } = await renameTripPlan(user.id, activeTrip.id, trimmedPlanName);
      const updatedTrip = enrichTripWithMeta({
        ...activeTrip,
        ...mapTripRowToForm(tripRow),
        planName: tripRow?.plan_name || trimmedPlanName,
        travelerCount: tripRow?.traveler_count || activeTrip.travelerCount,
        itinerary: activeTrip.itinerary,
        itineraryStatus: activeTrip.itineraryStatus || 'generated',
        itineraryError: activeTrip.itineraryError || '',
      });

      setTripMetaCache(updatedTrip.id, {
        planName: updatedTrip.planName,
        travelerCount: updatedTrip.travelerCount,
      });

      setActiveTrip((prev) => (
        prev?.id === updatedTrip.id
          ? {
              ...prev,
              ...updatedTrip,
            }
          : prev
      ));

      return updatedTrip;
    } finally {
      setIsRenamingTrip(false);
    }
  };

  const handlePersistQuestionnaireChatMessage = async (message) => {
    if (!editingTripId || !message?.content?.trim()) {
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Please log in again before saving Trippy chat history.');
    }

    await appendTripChatMessage(
      user.id,
      editingTripId,
      questionnaireDefaults.planName || questionnaireDefaults.destination,
      message.role,
      message.content
    );

    setTripChatMessages((prev) => [...prev, { role: message.role, content: message.content.trim() }]);
    setEditingTripChatBaseCount((count) => count + 1);
  };

  const handleRestoreItineraryVersion = async (version) => {
    if (!activeTrip?.id || !version?.id || isRestoringItineraryVersion) {
      return;
    }

    setIsRestoringItineraryVersion(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in again before restoring an itinerary version.');
      }

      const selectedVersion = await getItineraryVersionById(user.id, activeTrip.id, version.id);
      const now = new Date().toISOString();
      const restoredItinerary = {
        ...selectedVersion.itinerary_json,
        summary:
          selectedVersion.itinerary_json?.summary ||
          `Restored from version ${selectedVersion.version_number}.`,
      };

      const restoredRecord = await restoreItinerarySnapshot(
        user.id,
        activeTrip.id,
        restoredItinerary,
        activeTrip
      );
      const restoredSnapshot =
        restoredRecord?.itinerary_json?.tripSnapshot ||
        restoredRecord?.questionnaire_data ||
        {};
      const restoredTripFields = {};

      if (restoredSnapshot.planName) restoredTripFields.plan_name = restoredSnapshot.planName;
      if (restoredSnapshot.travelerCount) restoredTripFields.traveler_count = restoredSnapshot.travelerCount;
      if (restoredSnapshot.destination) restoredTripFields.destination = restoredSnapshot.destination;
      if (restoredSnapshot.departureCity) restoredTripFields.departure_city = restoredSnapshot.departureCity;
      if (restoredSnapshot.startDate) restoredTripFields.start_date = restoredSnapshot.startDate;
      if (restoredSnapshot.endDate) restoredTripFields.end_date = restoredSnapshot.endDate;
      if (restoredSnapshot.budget) restoredTripFields.budget_range = restoredSnapshot.budget;
      if (Array.isArray(restoredSnapshot.interests)) restoredTripFields.interests = restoredSnapshot.interests;

      const { data: restoredTripRow, error: tripUpdateError } = await supabase
        .from('trip_requests')
        .update({ ...restoredTripFields, status: 'restored', updated_at: now })
        .eq('id', activeTrip.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (tripUpdateError) {
        throw tripUpdateError;
      }

      const restoredTrip = enrichTripWithMeta({
        ...mapTripRowToForm(restoredTripRow),
        planName: restoredTripRow?.plan_name || restoredTripFields.plan_name || activeTrip.planName,
        travelerCount: restoredTripRow?.traveler_count || restoredTripFields.traveler_count || activeTrip.travelerCount,
      });

      setActiveTrip((prev) => ({
        ...prev,
        ...restoredTrip,
        itinerary: restoredRecord?.itinerary_json || restoredItinerary,
        itineraryStatus: 'generated',
        itineraryError: '',
        status: 'restored',
        updatedAt: restoredTrip.updatedAt || restoredRecord?.updated_at || now,
      }));

      setTripMetaCache(activeTrip.id, {
        planName: restoredTrip.planName,
        travelerCount: restoredTrip.travelerCount,
      });

      const versions = await loadItineraryVersions(activeTrip.id);
      setActiveVersionId(restoredRecord?.restored_version?.id || versions[0]?.id || '');
    } catch (error) {
      console.error('Restore itinerary version error:', error);
      setItineraryVersionsError(error?.message || 'Unable to restore that itinerary version.');
    } finally {
      setIsRestoringItineraryVersion(false);
    }
  };

  return (
    <div className="App">
      {isLoggedIn && (
        <button className="logout-top-left" onClick={handleLogout} title="Logout">
          Logout
        </button>
      )}
      <img src={tripaiLogo} alt="TripAI" className="app-title" />
      <div className="icon-buttons" aria-label="Primary navigation">
        {isLoggedIn && (
          <>
            <button
              className={`nav-icon-btn ${homeIsActive ? 'nav-icon-active' : ''}`}
              onClick={handleGoToMainMenu}
              title="Main Menu"
              aria-label="Main Menu"
            >
              🏠
            </button>
            <button
              className={`nav-icon-btn ${savedTripsIsActive ? 'nav-icon-active' : ''}`}
              onClick={handleViewPlans}
              title="Saved Trips"
              aria-label="Saved Trips"
            >
              ✈️
            </button>
          </>
        )}
        <button
          className={`settings-btn nav-icon-btn ${showSettings ? 'nav-icon-active' : ''}`}
          onClick={toggleSettings}
          title="Settings"
          aria-label="Settings"
        >
          ⚙️
        </button>
        {isLoggedIn && (
          <button
            className={`profile-btn ${showProfile ? 'nav-icon-active' : ''}`}
            onClick={toggleProfile}
            title="Profile"
            aria-label="Profile"
          >
            {avatarUrl ? (
              <img
                src={`${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}v=1`}
                alt="Profile"
                className="profile-avatar"
                onError={() => setAvatarUrl(null)}
              />
            ) : (
              '👤'
            )}
          </button>
        )}
      </div>
      {showResetPassword ? (
        <ResetPassword onResetComplete={handleResetComplete} />
      ) : showProfile ? (
        <ProfileSettings toggleProfile={toggleProfile} onAvatarUpdate={onAvatarUpdate} />
      ) : showSettings ? (
        <Settings toggleForm={toggleSettings} />
      ) : isInitializing ? (
        <div className="form-container">
          <h2>Loading...</h2>
          <p>Checking your session and travel preferences.</p>
        </div>
      ) : isLoggedIn ? (
        showQuestionnaire ? (
          <Questionnaire
            initialValues={questionnaireDefaults}
            initialChatMessages={tripChatMessages}
            isOnboarding={questionnaireMode === 'onboarding'}
            isSubmitting={isSubmittingQuestionnaire}
            submitError={questionnaireError}
            onBack={() => {
              setQuestionnaireError('');
              setShowQuestionnaire(false);
              setQuestionnaireMode('trip');
              setEditingTripId(null);
              setEditingTripChatBaseCount(0);
            }}
            onSubmit={handleQuestionnaireSubmit}
            onPersistChatMessage={handlePersistQuestionnaireChatMessage}
          />
        ) : activeTrip ? (
          <TravelItinerary
            tripData={activeTrip}
            isRegenerating={isRegeneratingItinerary}
            isRefining={isRefiningItinerary}
            isLoadingVersions={isLoadingItineraryVersions}
            isRestoringVersion={isRestoringItineraryVersion}
            isRenamingTrip={isRenamingTrip}
            versionHistory={itineraryVersions}
            activeVersionId={activeVersionId}
            versionHistoryError={itineraryVersionsError}
            trippyMessages={tripChatMessages}
            isLoadingTripChat={isLoadingTripChat}
            tripChatError={tripChatError}
            onRefinePlan={handleRefineItinerary}
            onUpdateTripMetadataAndRegenerate={handleUpdateTripMetadataAndRegenerate}
            onRegeneratePlan={handleRegenerateItinerary}
            onRenameTrip={handleRenameTrip}
            onRestoreVersion={handleRestoreItineraryVersion}
            onAppendTripChatMessage={handleAppendTripChatMessage}
          />
        ) : showSavedTrips ? (
          <ViewPlans
            onBackToMenu={() => setShowSavedTrips(false)}
            onNewTrip={() => handleStartPlan()}
            onSelectPlan={handleSelectTrip}
            onEditPlan={handleStartPlan}
          />
        ) : (
          <MainMenu
            onLogout={handleLogout}
            onStartPlan={() => handleStartPlan()}
            onViewPlans={handleViewPlans}
          />
        )
      ) : showLogin ? (
        <Login toggleForm={toggleForm} onLogin={handleLogin} />
      ) : (
        <SignUp toggleForm={toggleForm} onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
