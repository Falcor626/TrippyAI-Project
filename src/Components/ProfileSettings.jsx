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

function ProfileSettings({ toggleProfile, onAvatarUpdate }) {
    const [gender, setGender] = useState('');
    const [country, setCountry] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredCountries, setFilteredCountries] = useState([]);
    const [profileImage, setProfileImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Load user profile data on component mount
    useEffect(() => {
        const loadUserProfile = async () => {
            setIsLoading(true);
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    return;
                }

                const { data: profile, error: fetchError } = await supabase
                    .from('userProfiles')
                    .select('gender, country, avatar_url')
                    .eq('id', user.id)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    console.error('Error loading profile:', fetchError);
                    return;
                }

                if (profile) {
                    if (profile.gender) setGender(profile.gender);
                    if (profile.country) setCountry(profile.country);
                    if (profile.avatar_url) setPreviewUrl(profile.avatar_url);
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

    if (gender) profileData.gender = gender;
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

    // savedRows contains the resulting row (id, avatar_url, etc.)
    console.info('Saved profile row:', savedRows);

    alert('Profile updated successfully!');
    
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
                            <label htmlFor="gender">Gender:</label>
                            <input
                                type="text"
                                id="gender"
                                name="gender"
                                placeholder="Enter your gender"
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
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
