// ===================================
// PHOTOS MODULE
// Handles photo upload and management
// ===================================

const STORAGE_BUCKET = 'poi-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Upload photos for a comment
 * @param {Array<File>} files - Array of File objects
 * @param {string} commentId - The comment ID
 * @returns {Promise<Array>} Array of uploaded photo objects
 */
export async function uploadPhotos(files, commentId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get current user
    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    // Validate files
    const validFiles = files.filter(file => validateFile(file));
    
    if (validFiles.length === 0) {
      throw new Error('No valid files to upload');
    }

    console.log(`📤 Uploading ${validFiles.length} photos...`);

    const uploadedPhotos = [];

    for (const file of validFiles) {
      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const ext = file.name.split('.').pop();
        const filename = `${user.id}/${commentId}/${timestamp}_${randomStr}.${ext}`;

        // Upload to Storage
        const { data: uploadData, error: uploadError } = await sb.storage
          .from(STORAGE_BUCKET)
          .upload(filename, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = sb.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(filename);

        const photoUrl = urlData.publicUrl;

        // Save to database
        const { data: photoRecord, error: dbError } = await sb
          .from('poi_comment_photos')
          .insert({
            comment_id: commentId,
            photo_url: photoUrl,
            photo_filename: filename
          })
          .select()
          .single();

        if (dbError) {
          // Clean up uploaded file if DB insert fails
          await sb.storage.from(STORAGE_BUCKET).remove([filename]);
          throw dbError;
        }

        uploadedPhotos.push(photoRecord);
        console.log('✅ Photo uploaded:', filename);

      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        // Continue with other files even if one fails
      }
    }

    console.log(`✅ Successfully uploaded ${uploadedPhotos.length}/${validFiles.length} photos`);
    return uploadedPhotos;

  } catch (error) {
    console.error('Error uploading photos:', error);
    throw error;
  }
}

/**
 * Validate a file before upload
 * @param {File} file - The file to validate
 * @returns {boolean} True if valid
 */
function validateFile(file) {
  if (!file) {
    console.warn('⚠️ Invalid file object');
    return false;
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    console.warn(`⚠️ Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}`);
    window.showToast?.(`Nieprawidłowy format: ${file.name}`, 'error');
    return false;
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    console.warn(`⚠️ File too large: ${file.size} bytes (max ${MAX_FILE_SIZE})`);
    window.showToast?.(`Plik za duży: ${file.name} (max 5MB)`, 'error');
    return false;
  }

  return true;
}

/**
 * Delete a photo
 * @param {string} photoId - The photo ID
 * @param {string} photoFilename - The filename in storage
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deletePhoto(photoId, photoFilename) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get current user
    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    // Verify ownership through comment
    const { data: photo, error: photoError } = await sb
      .from('poi_comment_photos')
      .select(`
        id,
        comment_id,
        poi_comments (user_id)
      `)
      .eq('id', photoId)
      .single();

    if (photoError) throw photoError;
    if (!photo) throw new Error('Photo not found');

    const commentUserId = photo.poi_comments?.user_id;
    if (commentUserId !== user.id) {
      throw new Error('You can only delete photos from your own comments');
    }

    // Delete from database
    const { error: deleteDbError } = await sb
      .from('poi_comment_photos')
      .delete()
      .eq('id', photoId);

    if (deleteDbError) throw deleteDbError;

    // Delete from storage
    const { error: deleteStorageError } = await sb.storage
      .from(STORAGE_BUCKET)
      .remove([photoFilename]);

    if (deleteStorageError) {
      console.warn('⚠️ Failed to delete from storage:', deleteStorageError);
      // Don't throw - DB record is already deleted
    }

    console.log('✅ Photo deleted:', photoId);
    return true;

  } catch (error) {
    console.error('Error deleting photo:', error);
    throw error;
  }
}

/**
 * Get photos for a comment
 * @param {string} commentId - The comment ID
 * @returns {Promise<Array>} Array of photo objects
 */
export async function getCommentPhotos(commentId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    const { data: photos, error } = await sb
      .from('poi_comment_photos')
      .select('*')
      .eq('comment_id', commentId)
      .order('uploaded_at', { ascending: true });

    if (error) throw error;

    return photos || [];

  } catch (error) {
    console.error('Error getting comment photos:', error);
    return [];
  }
}

/**
 * Get all photos for a POI
 * @param {string} poiId - The POI identifier
 * @param {number} limit - Maximum number of photos
 * @returns {Promise<Array>} Array of photo objects
 */
export async function getPoiPhotos(poiId, limit = 50) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get all comments for POI
    const { data: comments, error: commentsError } = await sb
      .from('poi_comments')
      .select('id')
      .eq('poi_id', poiId);

    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) return [];

    const commentIds = comments.map(c => c.id);

    // Get photos for these comments
    const { data: photos, error: photosError } = await sb
      .from('poi_comment_photos')
      .select(`
        *,
        poi_comments (
          user_id,
          created_at
        )
      `)
      .in('comment_id', commentIds)
      .order('uploaded_at', { ascending: false })
      .limit(limit);

    if (photosError) throw photosError;

    return photos || [];

  } catch (error) {
    console.error('Error getting POI photos:', error);
    return [];
  }
}

/**
 * Get photos uploaded by a user
 * @param {string} userId - The user ID
 * @param {number} limit - Maximum number of photos
 * @returns {Promise<Array>} Array of photo objects
 */
export async function getUserPhotos(userId, limit = 20) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get user's comments
    const { data: comments, error: commentsError } = await sb
      .from('poi_comments')
      .select('id')
      .eq('user_id', userId);

    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) return [];

    const commentIds = comments.map(c => c.id);

    // Get photos for these comments
    const { data: photos, error: photosError } = await sb
      .from('poi_comment_photos')
      .select('*')
      .in('comment_id', commentIds)
      .order('uploaded_at', { ascending: false })
      .limit(limit);

    if (photosError) throw photosError;

    return photos || [];

  } catch (error) {
    console.error('Error getting user photos:', error);
    return [];
  }
}

/**
 * Get total photo count for a POI
 * @param {string} poiId - The POI identifier
 * @returns {Promise<number>} Number of photos
 */
export async function getPoiPhotoCount(poiId) {
  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error('Supabase client not available');

    // Get all comments for POI
    const { data: comments, error: commentsError } = await sb
      .from('poi_comments')
      .select('id')
      .eq('poi_id', poiId);

    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) return 0;

    const commentIds = comments.map(c => c.id);

    const { count, error } = await sb
      .from('poi_comment_photos')
      .select('*', { count: 'exact', head: true })
      .in('comment_id', commentIds);

    if (error) throw error;

    return count || 0;

  } catch (error) {
    console.error('Error getting POI photo count:', error);
    return 0;
  }
}

/**
 * Compress image before upload (client-side)
 * @param {File} file - The image file
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<File>} Compressed image file
 */
export async function compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Batch upload photos with progress tracking
 * @param {Array<File>} files - Array of File objects
 * @param {string} commentId - The comment ID
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<Array>} Array of uploaded photo objects
 */
export async function uploadPhotosWithProgress(files, commentId, progressCallback) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    try {
      const file = files[i];
      
      // Optionally compress large images
      let fileToUpload = file;
      if (file.size > 1 * 1024 * 1024) { // If > 1MB
        fileToUpload = await compressImage(file);
        console.log(`📦 Compressed ${file.name}: ${file.size} → ${fileToUpload.size} bytes`);
      }

      const uploaded = await uploadPhotos([fileToUpload], commentId);
      results.push(...uploaded);

      // Report progress
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: total,
          percentage: Math.round(((i + 1) / total) * 100),
          filename: file.name
        });
      }

    } catch (error) {
      console.error(`Error uploading ${files[i].name}:`, error);
    }
  }

  return results;
}

console.log('✅ Photos module loaded');
