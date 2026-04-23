import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './Components/login';
import SignUp from './Components/signUp';
import Settings from './Components/Settings';
import ProfileSettings from './Components/ProfileSettings';
import MainMenu from './Components/MainMenu';
import ResetPassword from './Components/ResetPassword';
import Questionnaire from './Components/Questionnaire';
import ViewPlans from './Components/ViewPlans';
import TravelItinerary from './Components/TravelItinerary';
import Trippi from './Components/Trippi';

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
  const [showTrippi, setShowTrippi] = useState(false);
  const [questionnaireMode, setQuestionnaireMode] = useState('trip');
  const [questionnaireDefaults, setQuestionnaireDefaults] = useState(emptyQuestionnaire);
  const [questionnaireError, setQuestionnaireError] = useState('');
  const [isSubmittingQuestionnaire, setIsSubmittingQuestionnaire] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [editingTripId, setEditingTripId] = useState(null);

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
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'recovery') {
      setShowResetPassword(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

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
    setShowSettings((prev) => !prev);
  };

  const toggleProfile = () => {
    setShowProfile((prev) => !prev);
  };

  const resetToLoggedOutState = () => {
    setIsLoggedIn(false);
    setShowLogin(true);
    setShowSettings(false);
    setShowProfile(false);
    setShowQuestionnaire(false);
    setShowSavedTrips(false);
    setShowTrippi(false);
    setQuestionnaireMode('trip');
    setQuestionnaireDefaults(emptyQuestionnaire);
    setQuestionnaireError('');
    setAvatarUrl(null);
    setActiveTrip(null);
    setEditingTripId(null);
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
    setEditingTripId(null);

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

  const handleResetComplete = () => {
    setShowResetPassword(false);
    setShowLogin(true);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleViewPlans = () => {
    setActiveTrip(null);
    setEditingTripId(null);
    setShowSavedTrips(true);
    setShowTrippi(false);
    setShowQuestionnaire(false);
    setShowProfile(false);
    setShowSettings(false);
  };

  const handleGoToMainMenu = () => {
    setActiveTrip(null);
    setEditingTripId(null);
    setShowQuestionnaire(false);
    setShowSavedTrips(false);
    setShowTrippi(false);
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
      setEditingTripId(tripToEdit.id || null);
      setQuestionnaireDefaults({
        destination: tripToEdit.destination || '',
        departureCity: tripToEdit.departureCity || '',
        startDate: tripToEdit.startDate || '',
        endDate: tripToEdit.endDate || '',
        budget: tripToEdit.budget || '',
        interests: tripToEdit.interests || [],
      });
    } else {
      const { defaults } = await getQuestionnaireDefaults(user.id);
      setQuestionnaireDefaults(defaults);
      setEditingTripId(null);
    }

    setQuestionnaireMode('trip');
    setQuestionnaireError('');
    setShowSavedTrips(false);
    setShowTrippi(false);
    setShowProfile(false);
    setShowSettings(false);
    setActiveTrip(null);
    setShowQuestionnaire(true);
  };

  const handleQuestionnaireSubmit = async (formData) => {
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

      if (editingTripId) {
        const { data, error: tripRequestError } = await supabase
          .from('trip_requests')
          .update({
            destination: formData.destination,
            departure_city: formData.departureCity,
            start_date: formData.startDate,
            end_date: formData.endDate,
            budget_range: formData.budget,
            interests: formData.interests,
            status: 'generated',
            updated_at: now,
          })
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
            destination: formData.destination,
            departure_city: formData.departureCity,
            start_date: formData.startDate,
            end_date: formData.endDate,
            budget_range: formData.budget,
            interests: formData.interests,
            status: 'generated',
            updated_at: now,
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
      setShowQuestionnaire(false);
      setShowSavedTrips(false);
      setShowTrippi(false);
      setEditingTripId(null);
      setActiveTrip(mapTripRowToForm(savedTripRow));
    } catch (error) {
      console.error('Questionnaire submit error:', error);
      setQuestionnaireError(error.message || 'Failed to save your questionnaire.');
      throw error;
    } finally {
      setIsSubmittingQuestionnaire(false);
    }
  };

  const handleSelectTrip = (trip) => {
    setActiveTrip(trip);
    setShowSavedTrips(false);
    setShowTrippi(false);
    setShowQuestionnaire(false);
  };


  const handleOpenTrippi = () => {
    setActiveTrip(null);
    setEditingTripId(null);
    setShowQuestionnaire(false);
    setShowSavedTrips(false);
    setShowProfile(false);
    setShowSettings(false);
    setQuestionnaireError('');
    setShowTrippi(true);
  };

  const handleRegenerateTrip = async () => {
    if (!activeTrip?.id) {
      return;
    }

    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('trip_requests')
        .update({ status: 'regenerated', updated_at: now })
        .eq('id', activeTrip.id);

      if (error) {
        throw error;
      }

      setActiveTrip((prev) => ({
        ...prev,
        status: 'regenerated',
        updatedAt: now,
      }));
    } catch (error) {
      console.error('Regenerate trip error:', error);
      alert(error.message || 'Unable to regenerate this itinerary right now.');
    }
  };

  return (
    <div className="App">
      {isLoggedIn && (
        <button className="logout-top-left" onClick={handleLogout} title="Logout">
          Logout
        </button>
      )}
      <h1 className="app-title">TrippyAI</h1>
      <div className="icon-buttons">
        {isLoggedIn && (
          <>
            <button className="nav-icon-btn" onClick={handleGoToMainMenu} title="Main Menu">
              🏠
            </button>
            <button className="nav-icon-btn" onClick={handleViewPlans} title="Saved Trips">
              ✈️
            </button>
          </>
        )}
        <button className="settings-btn nav-icon-btn" onClick={toggleSettings} title="Settings">
          ⚙️
        </button>
        {isLoggedIn && (
          <button className="profile-btn profile-right" onClick={toggleProfile} title="Profile">
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
      ) : showSettings ? (
        <Settings toggleForm={toggleSettings} />
      ) : showProfile ? (
        <ProfileSettings toggleProfile={toggleProfile} onAvatarUpdate={onAvatarUpdate} />
      ) : isInitializing ? (
        <div className="form-container">
          <h2>Loading...</h2>
          <p>Checking your session and travel preferences.</p>
        </div>
      ) : isLoggedIn ? (
        showTrippi ? (
          <Trippi onBack={handleGoToMainMenu} />
        ) : showQuestionnaire ? (
          <Questionnaire
            initialValues={questionnaireDefaults}
            isOnboarding={questionnaireMode === 'onboarding'}
            isSubmitting={isSubmittingQuestionnaire}
            submitError={questionnaireError}
            onBack={() => {
              setQuestionnaireError('');
              setShowQuestionnaire(false);
              setQuestionnaireMode('trip');
              setEditingTripId(null);
            }}
            onSubmit={handleQuestionnaireSubmit}
          />
        ) : activeTrip ? (
          <TravelItinerary tripData={activeTrip} />
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
            onTrippi={handleOpenTrippi}
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
