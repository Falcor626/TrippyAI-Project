import { supabase } from '../supabaseClient';
import { TRIPPY_API_BASE } from '../config';

/**
 * Deletes a user account and all related data from Supabase
 * Deletes records in order to respect foreign key constraints
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const deleteUserAccount = async () => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      throw new Error('Unable to retrieve current session');
    }

    const response = await fetch(`${TRIPPY_API_BASE}/delete-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to delete account. Please try again.');
    }

    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();

    return {
      success: true,
      message: 'Account and all associated data have been deleted successfully.'
    };

  } catch (error) {
    console.error('Error deleting account:', error);
    throw new Error(error.message || 'Failed to delete account. Please try again.');
  }
};
