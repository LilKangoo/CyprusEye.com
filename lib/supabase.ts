import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://daoohnbnnowmmcizgvrq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb29obmJubm93bW1jaXpndnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjkwNDksImV4cCI6MjA3NjM0NTA0OX0.AJrmxrk18yWxL1_Ejk_SZ1-X04YxN4C8LXCn9c3yFSM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type RatingStats = {
  poi_id: string;
  total_ratings: number;
  average_rating: number;
  five_star?: number;
  four_star?: number;
  three_star?: number;
  two_star?: number;
  one_star?: number;
  last_rated_at?: string;
};

/**
 * Get rating statistics for a POI
 */
export async function getRatingStats(poiId: string): Promise<RatingStats | null> {
  try {
    const { data, error } = await supabase
      .from('poi_rating_stats')
      .select('*')
      .eq('poi_id', poiId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching rating stats:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error in getRatingStats:', error);
    return null;
  }
}

/**
 * Get user's rating for a POI
 */
export async function getUserRating(poiId: string): Promise<number | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from('poi_ratings')
      .select('rating')
      .eq('poi_id', poiId)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user rating:', error);
      return null;
    }

    return data?.rating || null;
  } catch (error) {
    console.error('Error in getUserRating:', error);
    return null;
  }
}

/**
 * Rate a POI (1-5 stars)
 */
export async function ratePlace(poiId: string, rating: number): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('User must be logged in to rate');
      return false;
    }

    if (rating < 1 || rating > 5) {
      console.error('Rating must be between 1 and 5');
      return false;
    }

    const { error } = await supabase.from('poi_ratings').upsert(
      {
        poi_id: poiId,
        user_id: user.id,
        rating: rating,
      },
      {
        onConflict: 'poi_id,user_id',
      }
    );

    if (error) {
      console.error('Error saving rating:', error);
      return false;
    }

    console.log(`✅ Rating saved: ${rating} stars for ${poiId}`);
    return true;
  } catch (error) {
    console.error('Error in ratePlace:', error);
    return false;
  }
}
