import { supabase } from '../supabaseClient';

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

const generateItineraryPrompt = (questionnaire, attractions, weather) => {
  const interests = questionnaire.interests.map(id => ({
    adventure: 'Adventure',
    culture: 'Culture', 
    food: 'Food & Drink',
    nature: 'Nature',
    nightlife: 'Nightlife',
    relaxation: 'Relaxation',
    shopping: 'Shopping',
    photography: 'Photography'
  }[id])).filter(Boolean).join(', ');

  const budgetLabels = {
    budget: 'Budget-friendly (Under $1,000)',
    moderate: 'Moderate ($1,000 – $3,000)',
    comfort: 'Comfort ($3,000 – $7,000)',
    luxury: 'Luxury ($7,000+)'
  };

  const days = Math.ceil(
    (new Date(questionnaire.endDate) - new Date(questionnaire.startDate)) / 
    (1000 * 60 * 60 * 24)
  );

  const prompt = `Create a detailed ${days}-day travel itinerary for ${questionnaire.destination}.

**Trip Details:**
- Travelers: ${questionnaire.travelerCount || 1}
- Budget: ${budgetLabels[questionnaire.budget] || questionnaire.budget}
- Interests: ${interests}
- Dates: ${questionnaire.startDate} to ${questionnaire.endDate}

**Local Attractions Available:**
${attractions.map(a => `- ${a.name} (${a.source})`).join('\n')}

**Weather Forecast:**
${weather.map(w => `- ${w.date}: ${w.weatherCode}°C`).join('\n')}

Generate a day-by-day itinerary with:
1. Morning, afternoon, and evening activities
2. Specific restaurant or cafe recommendations where relevant
3. Transportation tips between locations
4. Budget estimates per day
5. Packing recommendations based on weather
6. Local tips and cultural insights

Format the response as a structured JSON object with this schema:
{
  "title": "string",
  "summary": "string",
  "days": [
    {
      "day": number,
      "date": "string",
      "activities": [
        {
          "time": "HH:MM",
          "title": "string",
          "description": "string",
          "location": "string",
          "estimatedCost": "string"
        }
      ],
      "meals": [
        {
          "type": "breakfast|lunch|dinner",
          "recommendation": "string",
          "estimatedCost": "string"
        }
      ],
      "tips": ["string"]
    }
  ],
  "packingList": ["string"],
  "generalTips": ["string"],
  "estimatedTotalBudget": "string"
}`;

  return prompt;
};

export const generateItinerary = async (questionnaire, attractions = [], weather = []) => {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Add REACT_APP_OPENAI_API_KEY to your .env file');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert travel planner. Generate detailed, personalized travel itineraries based on user preferences.'
          },
          {
            role: 'user',
            content: generateItineraryPrompt(questionnaire, attractions, weather)
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Itinerary generation error:', error);
    throw error;
  }
};

// Save itinerary to Supabase with versioning
export const saveItinerary = async (userId, tripRequestId, itinerary, aiModel = 'openai-gpt3.5') => {
  try {
    // First, check if an itinerary already exists for this trip request
    const { data: existingItinerary, error: fetchError } = await supabase
      .from('itineraries')
      .select('id, status')
      .eq('trip_request_id', tripRequestId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let itineraryId;
    let versionNumber = 1;

    if (existingItinerary) {
      // Update existing itinerary
      itineraryId = existingItinerary.id;
      
      // Get the next version number
      const { data: versions, error: versionError } = await supabase
        .from('itinerary_versions')
        .select('version_number')
        .eq('itinerary_id', itineraryId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionError && versionError.code !== 'PGRST116') throw versionError;
      versionNumber = (versions?.version_number || 0) + 1;

      // Update the main itinerary record
      const { error: updateError } = await supabase
        .from('itineraries')
        .update({
          status: 'current',
          summary: itinerary.summary || null,
          itinerary_json: itinerary,
          generation_source: aiModel,
          updated_at: new Date().toISOString()
        })
        .eq('id', itineraryId)
        .eq('user_id', userId);

      if (updateError) throw updateError;
    } else {
      // Create new itinerary
      const { data: newItinerary, error: insertError } = await supabase
        .from('itineraries')
        .insert({
          trip_request_id: tripRequestId,
          user_id: userId,
          status: 'current',
          summary: itinerary.summary || null,
          itinerary_json: itinerary,
          generation_source: aiModel
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      itineraryId = newItinerary.id;
    }

    // Insert into itinerary_versions for version history
    const { data: versionData, error: versionInsertError } = await supabase
      .from('itinerary_versions')
      .insert({
        itinerary_id: itineraryId,
        version_number: versionNumber,
        itinerary_json: itinerary,
        generation_source: aiModel
      })
      .select()
      .single();

    if (versionInsertError) throw versionInsertError;
    return versionData;
  } catch (error) {
    console.error('Error saving itinerary:', error);
    throw error;
  }
};

export default {
  generateItinerary,
  saveItinerary
};
