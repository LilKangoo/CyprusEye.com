(function attachHotelsV2PartnerMedia(root, factory) {
  root.HotelsV2PartnerMedia = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2PartnerMedia(root) {
  'use strict';

  const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const MAX_BYTES = 20 * 1024 * 1024;
  const MAX_WEBP_BYTES = 10 * 1024 * 1024;
  const MAX_FILES = 30;

  function client() {
    const value = typeof root.getSupabase === 'function' ? root.getSupabase() : (root.sb || root.__SB__);
    if (!value?.storage?.from) throw new Error('Partner Hotel media connection is unavailable.');
    return value;
  }

  function exactSlug(value) {
    const slug = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9_-]|-){0,179}$/.test(slug)) throw new Error('An exact safe Hotel slug is required for media upload.');
    return slug;
  }

  function exactUuid(value, label) {
    const id = String(value || '');
    if (!UUID.test(id)) throw new Error(`${label} must be an exact lowercase canonical UUID.`);
    return id;
  }

  function validateFiles(files) {
    const values = Array.from(files || []);
    if (!values.length || values.length > MAX_FILES) throw new Error('Choose from 1 to 30 Hotel images.');
    values.forEach((file) => {
      if (!file || !TYPES.has(String(file.type || '').toLowerCase())) throw new Error(`${file?.name || 'A selected file'} is not a supported JPEG, PNG, WebP or AVIF image.`);
      if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_BYTES) throw new Error(`${file?.name || 'A selected file'} must be non-empty and no larger than 20 MB.`);
    });
    return values;
  }

  function compress(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The selected image could not be read.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('The selected image could not be decoded.'));
        image.onload = () => {
          const ratio = Math.min(3840 / image.width, 2160 / image.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));
          const context = canvas.getContext('2d');
          if (!context) return reject(new Error('Image conversion is unavailable.'));
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => blob
            ? resolve(new File([blob], `${String(file.name || 'hotel-photo').replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' }))
            : reject(new Error('WebP conversion failed.')), 'image/webp', 0.9);
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  async function upload({ slug, assignmentId, roomId = null, files }) {
    const safeSlug = exactSlug(slug);
    const assignment = exactUuid(assignmentId, 'assignment_id');
    const room = roomId === null ? null : exactUuid(roomId, 'room_id');
    const selected = validateFiles(files);
    const bucket = client().storage.from('poi-photos');
    const uploadedUrls = [];
    try {
      for (const file of selected) {
        const uuid = exactUuid(crypto.randomUUID(), 'upload_id');
        const folder = room ? `rooms/${room}` : 'gallery';
        const path = `hotels/${safeSlug}/${folder}/partner-${assignment}-${uuid}.webp`;
        const webp = await compress(file);
        if (!Number.isFinite(webp.size) || webp.size <= 0 || webp.size > MAX_WEBP_BYTES) {
          const sizeError = new Error('The optimized WebP photo must be non-empty and no larger than 10 MB.');
          sizeError.code = 'partner_media_webp_size';
          throw sizeError;
        }
        const { error } = await bucket.upload(path, webp, { cacheControl: '31536000', upsert: false, contentType: 'image/webp' });
        if (error) throw error;
        const { data } = bucket.getPublicUrl(path);
        if (!data?.publicUrl) throw new Error('The uploaded media URL was not returned.');
        uploadedUrls.push(data.publicUrl);
      }
      return uploadedUrls;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      error.uploadedUrls = uploadedUrls;
      error.partialUpload = uploadedUrls.length > 0;
      throw error;
    }
  }

  return Object.freeze({ uploadProperty: (options) => upload({ ...options, roomId: null }), uploadRoom: upload });
});
