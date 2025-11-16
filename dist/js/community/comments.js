// ===================================
// COMMENTS MODULE
// Handles CRUD operations for POI comments
// ===================================

/**
 * Load all comments for a specific POI with nested replies
 * @param {string} poiId - The POI identifier
 * @returns {Promise<Array>} Array of comment objects with replies
 */
export async function loadComments(poiId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    console.log(`📥 Loading comments for POI: ${poiId}`);

    // Get all parent comments (no parent_comment_id) with user profiles
    const { data: comments, error } = await sb
      .from('poi_comments')
      .select(`
        id,
        poi_id,
        user_id,
        content,
        parent_comment_id,
        created_at,
        updated_at,
        is_edited,
        profiles (
          username,
          name,
          avatar_url,
          level,
          xp
        )
      `)
      .eq('poi_id', poiId)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading comments:', error);
      throw error;
    }

    // Debug: Log first comment's profile structure
    if (comments && comments.length > 0) {
      console.log('📊 Sample comment profile data:', {
        total_comments: comments.length,
        first_comment: {
          id: comments[0].id,
          user_id: comments[0].user_id,
          profile: comments[0].profiles,
          has_level: comments[0].profiles?.level !== undefined,
          level_value: comments[0].profiles?.level
        }
      });
    } else {
      console.log('ℹ️ No comments found for this POI');
    }

    // Load replies for each comment
    if (comments && comments.length > 0) {
      for (const comment of comments) {
        const replies = await loadReplies(comment.id);
        comment.replies = replies;
      }
    }

    return comments || [];

  } catch (error) {
    console.error('Error loading comments:', error);
    throw error;
  }
}

/**
 * Load replies for a specific comment
 * @param {string} parentCommentId - The parent comment ID
 * @returns {Promise<Array>} Array of reply objects
 */
async function loadReplies(parentCommentId) {
  try {
    const sb = window.getSupabase();

    const { data: replies, error } = await sb
      .from('poi_comments')
      .select(`
        id,
        poi_id,
        user_id,
        content,
        parent_comment_id,
        created_at,
        updated_at,
        is_edited,
        profiles (
          username,
          name,
          avatar_url,
          level,
          xp
        )
      `)
      .eq('parent_comment_id', parentCommentId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Debug: Log reply profile data if exists
    if (replies && replies.length > 0) {
      console.log(`📨 Loaded ${replies.length} replies, first reply has level:`, replies[0].profiles?.level);
    }

    return replies || [];

  } catch (error) {
    console.error('Error loading replies:', error);
    return [];
  }
}

/**
 * Add a new comment
 * @param {string} poiId - The POI identifier
 * @param {string} content - Comment content
 * @param {string|null} parentCommentId - Parent comment ID if reply
 * @returns {Promise<Object>} The created comment object
 */
export async function addComment(poiId, content, parentCommentId = null) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get current user
    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    // Validate content
    if (!content || !content.trim()) {
      throw new Error('Comment content cannot be empty');
    }

    if (content.length > 2000) {
      throw new Error('Comment is too long (max 2000 characters)');
    }

    // Insert comment
    const { data: comment, error } = await sb
      .from('poi_comments')
      .insert({
        poi_id: poiId,
        user_id: user.id,
        content: content.trim(),
        parent_comment_id: parentCommentId
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Comment added:', comment.id);
    return comment;

  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}

/**
 * Edit an existing comment
 * @param {string} commentId - The comment ID to edit
 * @param {string} newContent - New comment content
 * @returns {Promise<Object>} The updated comment object
 */
export async function editComment(commentId, newContent) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get current user
    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    // Validate content
    if (!newContent || !newContent.trim()) {
      throw new Error('Comment content cannot be empty');
    }

    if (newContent.length > 2000) {
      throw new Error('Comment is too long (max 2000 characters)');
    }

    // Check ownership
    const { data: existingComment, error: checkError } = await sb
      .from('poi_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (checkError) throw checkError;
    if (!existingComment) throw new Error('Comment not found');
    if (existingComment.user_id !== user.id) {
      throw new Error('You can only edit your own comments');
    }

    // Update comment
    const { data: comment, error } = await sb
      .from('poi_comments')
      .update({
        content: newContent.trim(),
        updated_at: new Date().toISOString(),
        is_edited: true
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Comment edited:', commentId);
    return comment;

  } catch (error) {
    console.error('Error editing comment:', error);
    throw error;
  }
}

/**
 * Delete a comment
 * @param {string} commentId - The comment ID to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteComment(commentId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get current user
    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    // Check ownership
    const { data: existingComment, error: checkError } = await sb
      .from('poi_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (checkError) throw checkError;
    if (!existingComment) throw new Error('Comment not found');
    if (existingComment.user_id !== user.id) {
      throw new Error('You can only delete your own comments');
    }

    // Delete comment (cascade will handle photos, likes, notifications)
    const { error } = await sb
      .from('poi_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;

    console.log('✅ Comment deleted:', commentId);
    return true;

  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
}

/**
 * Reply to a comment
 * @param {string} poiId - The POI identifier
 * @param {string} content - Reply content
 * @param {string} parentCommentId - Parent comment ID
 * @returns {Promise<Object>} The created reply object
 */
export async function replyToComment(poiId, content, parentCommentId) {
  return addComment(poiId, content, parentCommentId);
}

/**
 * Get total comment count for a POI
 * @param {string} poiId - The POI identifier
 * @returns {Promise<number>} Total number of comments (including replies)
 */
export async function getCommentCount(poiId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { count, error } = await sb
      .from('poi_comments')
      .select('*', { count: 'exact', head: true })
      .eq('poi_id', poiId);

    if (error) throw error;

    return count || 0;

  } catch (error) {
    console.error('Error getting comment count:', error);
    return 0;
  }
}

/**
 * Get comments by a specific user
 * @param {string} userId - The user ID
 * @param {number} limit - Maximum number of comments to return
 * @returns {Promise<Array>} Array of comment objects
 */
export async function getUserComments(userId, limit = 10) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { data: comments, error } = await sb
      .from('poi_comments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return comments || [];

  } catch (error) {
    console.error('Error getting user comments:', error);
    return [];
  }
}

/**
 * Search comments by content
 * @param {string} searchTerm - Search term
 * @param {string|null} poiId - Optional POI filter
 * @returns {Promise<Array>} Array of matching comments
 */
export async function searchComments(searchTerm, poiId = null) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    let query = sb
      .from('poi_comments')
      .select('*')
      .ilike('content', `%${searchTerm}%`)
      .order('created_at', { ascending: false });

    if (poiId) {
      query = query.eq('poi_id', poiId);
    }

    const { data: comments, error } = await query;

    if (error) throw error;

    return comments || [];

  } catch (error) {
    console.error('Error searching comments:', error);
    return [];
  }
}

/**
 * Check if user has commented on a POI
 * @param {string} poiId - The POI identifier
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} True if user has commented
 */
export async function hasUserCommented(poiId, userId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { count, error } = await sb
      .from('poi_comments')
      .select('*', { count: 'exact', head: true })
      .eq('poi_id', poiId)
      .eq('user_id', userId);

    if (error) throw error;

    return (count || 0) > 0;

  } catch (error) {
    console.error('Error checking user comment:', error);
    return false;
  }
}

/**
 * Get most active commenters for a POI
 * @param {string} poiId - The POI identifier
 * @param {number} limit - Number of users to return
 * @returns {Promise<Array>} Array of user IDs with comment counts
 */
export async function getActiveCommenters(poiId, limit = 5) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { data: comments, error } = await sb
      .from('poi_comments')
      .select('user_id')
      .eq('poi_id', poiId);

    if (error) throw error;

    // Count comments per user
    const userCounts = {};
    comments?.forEach(c => {
      userCounts[c.user_id] = (userCounts[c.user_id] || 0) + 1;
    });

    // Sort and limit
    const sorted = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId, count]) => ({ userId, count }));

    return sorted;

  } catch (error) {
    console.error('Error getting active commenters:', error);
    return [];
  }
}

console.log('✅ Comments module loaded');
