import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './ProfileSettings.css';

const COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
    'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
    'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei',
    'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic',
    'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
    'Czech Republic', 'Czechia', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor', 'Ecuador',
    'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Ethiopia', 'Fiji', 'Finland',
    'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
    'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India',
    'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan',
    'Kazakhstan', 'Kenya', 'Kiribati', 'Korea', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos',
    'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
    'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania',
    'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco',
    'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua',
    'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau',
    'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
    'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
    'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
    'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa',
    'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
    'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga',
    'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
    'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
    'Yemen', 'Zambia', 'Zimbabwe'
];

const INTERESTS = [
    { id: 'adventure', label: 'Adventure' },
    { id: 'culture', label: 'Culture' },
    { id: 'food', label: 'Food & Drink' },
    { id: 'nature', label: 'Nature' },
    { id: 'nightlife', label: 'Nightlife' },
    { id: 'relaxation', label: 'Relaxation' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'photography', label: 'Photography' },
];

const BUDGETS = [
    { id: 'budget', label: 'Budget', sub: 'Under $1,000' },
    { id: 'moderate', label: 'Moderate', sub: '$1,000 - $3,000' },
    { id: 'comfort', label: 'Comfort', sub: '$3,000 - $7,000' },
    { id: 'luxury', label: 'Luxury', sub: '$7,000+' },
];

function ProfileSettings({ toggleProfile, onAvatarUpdate }) {
    const [username, setUsername] = useState('');
    const [fullName, setFullName] = useState('');
    const [pronouns, setPronouns] = useState('');
    const [country, setCountry] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredCountries, setFilteredCountries] = useState([]);
    const [profileImage, setProfileImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [preferredDepartureCity, setPreferredDepartureCity] = useState('');
    const [preferredBudget, setPreferredBudget] = useState('');
    const [preferredInterests, setPreferredInterests] = useState([]);

    // Load user profile data on component mount
    useEffect(() => {
        const loadUserProfile = async () => {
            setIsLoading(true);
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    return;
                }

                // Get user metadata (username, full_name from auth)
                if (user.user_metadata) {
                    if (user.user_metadata.username) setUsername(user.user_metadata.username);
                    if (user.user_metadata.full_name) setFullName(user.user_metadata.full_name);
                }

                const { data: profile, error: fetchError } = await supabase
                    .from('userProfiles')
                    .select('pronouns, country, avatar_url')
                    .eq('id', user.id)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    console.error('Error loading profile:', fetchError);
                    return;
                }

                if (profile) {
                    if (profile.pronouns) setPronouns(profile.pronouns);
                    if (profile.country) setCountry(profile.country);
                    if (profile.avatar_url) setPreviewUrl(profile.avatar_url);
                }

                const { data: preferences, error: preferencesError } = await supabase
                    .from('traveler_preferences')
                    .select('preferred_departure_city, preferred_budget, preferred_interests')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (preferencesError) {
                    console.warn('Error loading traveler preferences:', preferencesError.message);
                }

                if (preferences) {
                    setPreferredDepartureCity(preferences.preferred_departure_city || '');
                    setPreferredBudget(preferences.preferred_budget || '');
                    setPreferredInterests(preferences.preferred_interests || []);
                }
            } catch (err) {
                console.error('Failed to load profile:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadUserProfile();
    }, []);

    const handleCountryChange = (value) => {
        setCountry(value);
        
        if (value.trim() === '') {
            setFilteredCountries([]);
            setShowDropdown(false);
        } else {
            const filtered = COUNTRIES.filter(c => 
                c.toLowerCase().startsWith(value.toLowerCase())
            );
            setFilteredCountries(filtered);
            setShowDropdown(filtered.length > 0);
        }
    };

    const handleCountrySelect = (selectedCountry) => {
        setCountry(selectedCountry);
        setShowDropdown(false);
        setFilteredCountries([]);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please select a valid image file');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setError('Image size must be less than 5MB');
                return;
            }
            setProfileImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setError('');
        }
    };

    const togglePreferredInterest = (interestId) => {
        setPreferredInterests((current) =>
            current.includes(interestId)
                ? current.filter((id) => id !== interestId)
                : [...current, interestId]
        );
    };

    const handleRemoveImage = async () => {
        setProfileImage(null);
        setPreviewUrl(null);
        
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('User not authenticated');
            }

            // Clear avatar_url from database
            const { error: updateError } = await supabase
                .from('userProfiles')
                .update({ avatar_url: null })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Update parent component's avatar state
            if (onAvatarUpdate) {
                onAvatarUpdate(null);
            }

            console.info('Profile picture removed');
        } catch (err) {
            setError(err.message || 'Failed to remove profile picture');
            console.error('Remove Image Error:', err);
        }
    };

const handleSave = async () => {
  setError('');
  setSuccessMessage('');
  setUploading(true);
  let imageUrl = null;

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    if (profileImage) {
      const fileExt = profileImage.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `profile-pictures/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, profileImage);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      imageUrl = data.publicUrl;
    }

    // Prepare data for database update — use DB column names
    const profileData = {
      id: user.id
      // do not include updated_at unless that column exists
    };

    if (pronouns) profileData.pronouns = pronouns;
    if (country) profileData.country = country;
    if (imageUrl) profileData.avatar_url = imageUrl; // <- changed to avatar_url

    // Save or update profile in userProfiles table and return the row
    const { data: savedRows, error: saveError } = await supabase
      .from('userProfiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single(); // optional: use .single() if you expect exactly one row

    if (saveError) {
      if (saveError.message && saveError.message.includes('row-level security')) {
        throw new Error('Database access denied. Please set up RLS policies in Supabase.');
      }
      throw saveError;
    }

    const { error: preferencesSaveError } = await supabase.from('traveler_preferences').upsert(
      {
        user_id: user.id,
        preferred_departure_city: preferredDepartureCity.trim() || null,
        preferred_budget: preferredBudget || null,
        preferred_interests: preferredInterests,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (preferencesSaveError) {
      throw preferencesSaveError;
    }

    // savedRows contains the resulting row (id, avatar_url, etc.)
    console.info('Saved profile row:', savedRows);

    setSuccessMessage('Profile and travel preferences updated.');
    
    // Update parent component's avatar state
    if (onAvatarUpdate) {
      onAvatarUpdate(savedRows.avatar_url || null);
    }
    
    // Clear the selected file but keep the preview if it exists
    setProfileImage(null);
    // Don't clear previewUrl - keep showing the saved image
  } catch (err) {
    setError(err.message || 'Failed to save profile');
    console.error('Save Profile Error:', err);
  } finally {
    setUploading(false);
  }
};

    return (
        <div className="form-container profile-settings-container">
            <h2>Profile Settings</h2>
            
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>Loading your profile...</p>
                </div>
            ) : (
                <>
                    {error && <div className="error-message">{error}</div>}
                    {successMessage && <div className="success-message">{successMessage}</div>}
                    <div className="profile-section">
                        <div className="profile-picture-item">
                            <label>Profile Picture:</label>
                            <div className="profile-picture-container">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Profile Preview" className="profile-preview" />
                                ) : (
                                    <div className="profile-placeholder">📷</div>
                                )}
                            </div>
                            
                            <div className="profile-name-info">
                                {username && <p className="username"><strong>{username}</strong></p>}
                                {fullName && <p className="full-name">{fullName}</p>}
                            </div>
                            
                            <input
                                type="file"
                                id="profileImage"
                                name="profileImage"
                                accept="image/*"
                                onChange={handleImageChange}
                                style={{ display: 'none' }}
                            />
                            <div className="profile-image-buttons">
                                <button
                                    type="button"
                                    className="upload-btn"
                                    onClick={() => document.getElementById('profileImage').click()}
                                >
                                    {previewUrl ? 'Change Photo' : 'Upload Photo'}
                                </button>
                                {previewUrl && (
                                    <button
                                        type="button"
                                        className="remove-btn"
                                        onClick={handleRemoveImage}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="profile-item">
                            <label htmlFor="pronouns">Pronouns:</label>
                            <input
                                type="text"
                                id="pronouns"
                                name="pronouns"
                                placeholder="e.g., he/him, she/her, they/them"
                                value={pronouns}
                                onChange={(e) => setPronouns(e.target.value)}
                                disabled={uploading}
                            />
                        </div>

                        <div className="profile-item">
                            <label htmlFor="country">Country:</label>
                            <div className="country-dropdown-wrapper">
                                <input
                                    type="text"
                                    id="country"
                                    name="country"
                                    placeholder="Enter your country"
                                    value={country}
                                    onChange={(e) => handleCountryChange(e.target.value)}
                                    onFocus={() => country && setShowDropdown(filteredCountries.length > 0)}
                                    disabled={uploading}
                                />
                                {showDropdown && filteredCountries.length > 0 && (
                                    <ul className="country-dropdown">
                                        {filteredCountries.map((c) => (
                                            <li key={c} onClick={() => handleCountrySelect(c)}>
                                                {c}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="traveler-preferences-section">
                            <div>
                                <h3>Traveler Preferences</h3>
                                <p>These defaults are loaded when you start a new trip.</p>
                            </div>

                            <div className="profile-item">
                                <label htmlFor="preferredDepartureCity">Default Departure City:</label>
                                <input
                                    type="text"
                                    id="preferredDepartureCity"
                                    name="preferredDepartureCity"
                                    placeholder="e.g. Los Angeles, CA"
                                    value={preferredDepartureCity}
                                    onChange={(e) => setPreferredDepartureCity(e.target.value)}
                                    disabled={uploading}
                                />
                            </div>

                            <div className="profile-item">
                                <label>Preferred Budget:</label>
                                <div className="preference-budget-grid">
                                    {BUDGETS.map((budget) => (
                                        <button
                                            key={budget.id}
                                            type="button"
                                            className={`preference-option ${preferredBudget === budget.id ? 'preference-option-selected' : ''}`}
                                            onClick={() => setPreferredBudget(budget.id)}
                                            disabled={uploading}
                                        >
                                            <span>{budget.label}</span>
                                            <small>{budget.sub}</small>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="profile-item">
                                <label>Preferred Interests:</label>
                                <div className="preference-interest-grid">
                                    {INTERESTS.map((interest) => (
                                        <button
                                            key={interest.id}
                                            type="button"
                                            className={`preference-option ${preferredInterests.includes(interest.id) ? 'preference-option-selected' : ''}`}
                                            onClick={() => togglePreferredInterest(interest.id)}
                                            disabled={uploading}
                                        >
                                            {interest.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="button-group">
                        <button 
                            type="button" 
                            className="profile-save-btn" 
                            onClick={handleSave}
                            disabled={uploading}
                        >
                            {uploading ? 'Saving...' : 'Save'}
                        </button>
                        <button 
                            type="button" 
                            className="secondary-button" 
                            onClick={toggleProfile}
                            disabled={uploading}
                        >
                            Back
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default ProfileSettings;
