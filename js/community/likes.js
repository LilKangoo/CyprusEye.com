// ===================================
// LIKES MODULE
// Handles like/unlike operations for comments
// ===================================

/**
 * Like a comment
 * @param {string} commentId - The comment ID to like
 * @param {string} userId - The user ID who likes
 * @returns {Promise<Object>} The created like object
 */
export async function likeComment(commentId, userId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Check if already liked
    const alreadyLiked = await hasUserLiked(commentId, userId);
    if (alreadyLiked) {
      console.log('ℹ️ Comment already liked');
      return null;
    }

    // Insert like
    const { data: like, error } = await sb
      .from('poi_comment_likes')
      .insert({
        comment_id: commentId,
        user_id: userId
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (already liked)
      if (error.code === '23505') {
        console.log('ℹ️ Comment already liked (duplicate prevented)');
        return null;
      }
      throw error;
    }

    console.log('✅ Comment liked:', commentId);
    return like;

  } catch (error) {
    console.error('Error liking comment:', error);
    throw error;
  }
}

/**
 * Unlike a comment
 * @param {string} commentId - The comment ID to unlike
 * @param {string} userId - The user ID who unlikes
 * @returns {Promise<boolean>} True if unliked successfully
 */
export async function unlikeComment(commentId, userId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { error } = await sb
      .from('poi_comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    if (error) throw error;

    console.log('✅ Comment unliked:', commentId);
    return true;

  } catch (error) {
    console.error('Error unliking comment:', error);
    throw error;
  }
}

/**
 * Check if a user has liked a comment
 * @param {string} commentId - The comment ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} True if user has liked
 */
export async function hasUserLiked(commentId, userId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { count, error } = await sb
      .from('poi_comment_likes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    if (error) throw error;

    return (count || 0) > 0;

  } catch (error) {
    console.error('Error checking if user liked:', error);
    return false;
  }
}

/**
 * Get total likes count for a comment
 * @param {string} commentId - The comment ID
 * @returns {Promise<number>} Number of likes
 */
export async function getLikesCount(commentId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { count, error } = await sb
      .from('poi_comment_likes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId);

    if (error) throw error;

    return count || 0;

  } catch (error) {
    console.error('Error getting likes count:', error);
    return 0;
  }
}

/**
 * Get users who liked a comment
 * @param {string} commentId - The comment ID
 * @param {number} limit - Maximum number of users to return
 * @returns {Promise<Array>} Array of user IDs
 */
export async function getCommentLikers(commentId, limit = 10) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { data: likes, error } = await sb
      .from('poi_comment_likes')
      .select('user_id, created_at')
      .eq('comment_id', commentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return likes || [];

  } catch (error) {
    console.error('Error getting comment likers:', error);
    return [];
  }
}

/**
 * Get all comments liked by a user
 * @param {string} userId - The user ID
 * @param {number} limit - Maximum number of comments to return
 * @returns {Promise<Array>} Array of comment IDs
 */
export async function getUserLikedComments(userId, limit = 20) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { data: likes, error } = await sb
      .from('poi_comment_likes')
      .select('comment_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return likes || [];

  } catch (error) {
    console.error('Error getting user liked comments:', error);
    return [];
  }
}

/**
 * Get most liked comments for a POI
 * @param {string} poiId - The POI identifier
 * @param {number} limit - Number of comments to return
 * @returns {Promise<Array>} Array of comment objects with like counts
 */
export async function getMostLikedComments(poiId, limit = 5) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get all comments for POI
    const { data: comments, error: commentsError } = await sb
      .from('poi_comments')
      .select('id, content, user_id, created_at')
      .eq('poi_id', poiId);

    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) return [];

    // Get likes count for each comment
    const commentsWithLikes = await Promise.all(
      comments.map(async (comment) => {
        const likesCount = await getLikesCount(comment.id);
        return { ...comment, likesCount };
      })
    );

    // Sort by likes and limit
    const sorted = commentsWithLikes
      .sort((a, b) => b.likesCount - a.likesCount)
      .slice(0, limit);

    return sorted;

  } catch (error) {
    console.error('Error getting most liked comments:', error);
    return [];
  }
}

/**
 * Toggle like status (like if not liked, unlike if liked)
 * @param {string} commentId - The comment ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Object with status and new like count
 */
export async function toggleLike(commentId, userId) {
  try {
    const liked = await hasUserLiked(commentId, userId);

    if (liked) {
      await unlikeComment(commentId, userId);
    } else {
      await likeComment(commentId, userId);
    }

    const newCount = await getLikesCount(commentId);

    return {
      liked: !liked,
      count: newCount
    };

  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
}

/**
 * Get like statistics for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Object with like statistics
 */
export async function getUserLikeStats(userId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get likes given
    const { count: likesGiven, error: givenError } = await sb
      .from('poi_comment_likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (givenError) throw givenError;

    // Get likes received (on user's comments)
    const { data: userComments, error: commentsError } = await sb
      .from('poi_comments')
      .select('id')
      .eq('user_id', userId);

    if (commentsError) throw commentsError;

    const commentIds = userComments?.map(c => c.id) || [];
    
    let likesReceived = 0;
    if (commentIds.length > 0) {
      const { count, error: receivedError } = await sb
        .from('poi_comment_likes')
        .select('*', { count: 'exact', head: true })
        .in('comment_id', commentIds);

      if (!receivedError) {
        likesReceived = count || 0;
      }
    }

    return {
      likesGiven: likesGiven || 0,
      likesReceived: likesReceived
    };

  } catch (error) {
    console.error('Error getting user like stats:', error);
    return {
      likesGiven: 0,
      likesReceived: 0
    };
  }
}

/**
 * Subscribe to real-time like updates for a comment
 * @param {string} commentId - The comment ID
 * @param {Function} callback - Callback function called on like changes
 * @returns {Object} Subscription object
 */
export function subscribeLikeUpdates(commentId, callback) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const subscription = sb
      .channel(`likes:${commentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poi_comment_likes',
          filter: `comment_id=eq.${commentId}`
        },
        async (payload) => {
          const newCount = await getLikesCount(commentId);
          callback({
            event: payload.eventType,
            count: newCount,
            payload: payload.new || payload.old
          });
        }
      )
      .subscribe();

    console.log('✅ Subscribed to like updates for comment:', commentId);

    return subscription;

  } catch (error) {
    console.error('Error subscribing to like updates:', error);
    return null;
  }
}

console.log('✅ Likes module loaded');
