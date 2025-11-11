/**
 * ADMIN PANEL - CYPRUSEYE.COM
 * Main JavaScript for admin panel functionality
 */

// =====================================================
// CONFIGURATION & GLOBALS
// =====================================================

const ADMIN_CONFIG = {
  requiredEmail: 'lilkangoomedia@gmail.com',
  requiredUserId: '15f3d442-092d-4eb8-9627-db90da0283eb',
  usersPerPage: 20,
};

let adminState = {
  user: null,
  profile: null,
  isAdmin: false,
  currentView: 'dashboard',
  usersPage: 1,
  usersTotal: 0,
  loading: true,
  pois: [],
  poisLoaded: false,
  poiLoading: false,
  poiSearch: '',
  poiFilterCategory: 'all',
  poiFilterStatus: 'all',
  poiDataSource: 'supabase',
  selectedPoi: null,
  poiFormMode: 'create',
  quests: [],
  questFormMode: 'create',
  selectedQuest: null,
};

// =====================================================
// SUPABASE CLIENT
// =====================================================

// Wait for Supabase client to be available
function getSupabaseClient() {
  if (typeof window.getSupabase === 'function') {
    return window.getSupabase();
  }
  if (window.sb) {
    return window.sb;
  }
  if (window.__SB__) {
    return window.__SB__;
  }
  return null;
}

// Helper to ensure Supabase is available
function ensureSupabase() {
  if (!sb) {
    sb = getSupabaseClient();
  }
  return sb;
}

// Try to get client immediately
let sb = getSupabaseClient();

// If not available, wait a bit
if (!sb) {
  console.warn('Supabase client not immediately available, waiting...');
}

// =====================================================
// DOM HELPERS
// =====================================================

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => root.querySelectorAll(selector);

function showElement(element) {
  if (element) {
    element.hidden = false;
    element.style.display = '';
  }
}

// =====================================================
// TRIP BOOKINGS MODULE
// =====================================================

async function loadTripBookingsData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log('Loading trip bookings data...');

    const { data: bookings, error } = await client
      .from('trip_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading trip bookings:', error);
      throw error;
    }

    console.log('Trip bookings loaded:', bookings);

    // Calculate stats
    const totalBookings = bookings?.length || 0;
    const pendingBookings = bookings?.filter(b => b.status === 'pending').length || 0;
    const confirmedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0;
    const totalRevenue = bookings
      ?.filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.total_price)
      .reduce((sum, b) => sum + parseFloat(b.total_price), 0) || 0;

    // Update stats if elements exist
    const statTotal = $('#statTripBookingsTotal');
    const statPending = $('#statTripBookingsPending');
    const statConfirmed = $('#statTripBookingsConfirmed');
    const statRevenue = $('#statTripBookingsRevenue');

    if (statTotal) statTotal.textContent = totalBookings;
    if (statPending) statPending.textContent = pendingBookings;
    if (statConfirmed) statConfirmed.textContent = confirmedBookings;
    if (statRevenue) statRevenue.textContent = `€${totalRevenue.toFixed(2)}`;

    // Update table
    const tableBody = $('#tripBookingsTableBody');
    if (!tableBody) return;

    if (!bookings || bookings.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading">
            No trip bookings yet. System is ready to accept bookings!
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = bookings.map(booking => {
      const statusClass = 
        booking.status === 'confirmed' ? 'badge-success' :
        booking.status === 'completed' ? 'badge-success' :
        booking.status === 'pending' ? 'badge-warning' :
        booking.status === 'cancelled' ? 'badge-danger' : 'badge';
      
      return `
        <tr>
          <td>
            <div style="font-weight: 600;">#${booking.id.slice(0, 8).toUpperCase()}</div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${escapeHtml(booking.trip_slug || 'N/A')}
            </div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(booking.customer_name || 'N/A')}</div>
            <div style="font-size: 12px; color: var(--admin-text-muted);">${escapeHtml(booking.customer_email || '')}</div>
            ${booking.customer_phone ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(booking.customer_phone)}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 12px;">
              ${booking.trip_date ? '🎯 ' + new Date(booking.trip_date).toLocaleDateString('en-GB') : ''}
            </div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 4px;">
              ${booking.arrival_date && booking.departure_date ? 
                `✈️ ${new Date(booking.arrival_date).toLocaleDateString('en-GB')} - ${new Date(booking.departure_date).toLocaleDateString('en-GB')}` 
                : 'No dates'}
            </div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${booking.num_adults || booking.num_hours || booking.num_days ? 
                (booking.num_adults ? `👥 ${booking.num_adults}+${booking.num_children || 0}` : '') +
                (booking.num_hours ? ` ⏱️ ${booking.num_hours}h` : '') +
                (booking.num_days ? ` 📅 ${booking.num_days}d` : '')
                : ''}
            </div>
          </td>
          <td>
            <span class="badge ${statusClass}">
              ${(booking.status || 'unknown').toUpperCase()}
            </span>
          </td>
          <td style="font-weight: 600; color: var(--admin-success);">
            €${Number(booking.total_price || 0).toFixed(2)}
          </td>
          <td>
            <button class="btn-secondary" onclick="viewTripBookingDetails('${booking.id}')" title="View details">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');

    showToast('Trip bookings loaded successfully', 'success');

  } catch (error) {
    console.error('Failed to load trip bookings:', error);
    showToast('Failed to load trip bookings: ' + (error.message || 'Unknown error'), 'error');
    
    const tableBody = $('#tripBookingsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading" style="color: var(--admin-danger);">
            ❌ Error loading data: ${escapeHtml(error.message || 'Unknown error')}
            <br><small style="margin-top: 8px; display: block;">
              Make sure the trip_bookings table exists in Supabase. 
              Run the migration: supabase/migrations/015_trip_bookings_table.sql
            </small>
          </td>
        </tr>
      `;
    }
  }
}

async function viewTripBookingDetails(bookingId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    console.log('Loading trip booking details:', bookingId);

    const { data: booking, error } = await client
      .from('trip_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error loading booking:', error);
      showToast('Failed to load booking details', 'error');
      return;
    }

    if (!booking) {
      showToast('Booking not found', 'error');
      return;
    }

    // Show modal
    const modal = $('#tripBookingDetailsModal');
    const content = $('#tripBookingDetailsContent');
    if (!modal || !content) {
      console.error('Modal elements not found');
      return;
    }

    // Format dates
    const tripDate = booking.trip_date ? new Date(booking.trip_date).toLocaleDateString('en-GB') : 'Not set';
    const arrivalDate = booking.arrival_date ? new Date(booking.arrival_date).toLocaleDateString('en-GB') : 'N/A';
    const departureDate = booking.departure_date ? new Date(booking.departure_date).toLocaleDateString('en-GB') : 'N/A';
    const createdAt = booking.created_at ? new Date(booking.created_at).toLocaleString('en-GB') : 'N/A';

    // Status badge
    const statusClass = 
      booking.status === 'confirmed' ? 'badge-success' :
      booking.status === 'pending' ? 'badge-warning' :
      booking.status === 'cancelled' ? 'badge-danger' :
      booking.status === 'completed' ? 'badge-success' : 'badge';

    // Build content HTML
    content.innerHTML = `
      <div style="display: grid; gap: 24px;">
        <!-- Header Info -->
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 600;">Booking #${booking.id.slice(0, 8).toUpperCase()}</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: var(--admin-text-muted);">Trip: ${escapeHtml(booking.trip_slug || 'N/A')}</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: var(--admin-text-muted);">Created: ${createdAt}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <select id="tripBookingStatusDropdown" class="admin-form-field" style="padding: 8px 12px; font-size: 14px; font-weight: 600;" onchange="updateTripBookingStatus('${booking.id}', this.value)">
                <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
                <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>✔️ Completed</option>
                <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
              </select>
              <span class="badge ${statusClass}" style="font-size: 14px; padding: 6px 12px;">${(booking.status || 'pending').toUpperCase()}</span>
            </div>
          </div>
        </div>

        <!-- Customer Information -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Customer Information</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Name:</span>
              <span>${escapeHtml(booking.customer_name || 'N/A')}</span>
            </div>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Email:</span>
              <span><a href="mailto:${escapeHtml(booking.customer_email)}">${escapeHtml(booking.customer_email || 'N/A')}</a></span>
            </div>
            ${booking.customer_phone ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Phone:</span>
              <span><a href="tel:${escapeHtml(booking.customer_phone)}">${escapeHtml(booking.customer_phone)}</a></span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Trip Details -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Trip Details</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Preferred Date:</span>
              <span>🎯 ${tripDate}</span>
            </div>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Stay on Cyprus:</span>
              <span>✈️ ${arrivalDate} → ${departureDate}</span>
            </div>
            ${booking.num_adults ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Participants:</span>
              <span>👥 ${booking.num_adults} adult(s), ${booking.num_children || 0} child(ren)</span>
            </div>
            ` : ''}
            ${booking.num_hours ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Duration:</span>
              <span>⏱️ ${booking.num_hours} hour(s)</span>
            </div>
            ` : ''}
            ${booking.num_days ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Duration:</span>
              <span>📅 ${booking.num_days} day(s)</span>
            </div>
            ` : ''}
            ${booking.notes ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Notes:</span>
              <span>${escapeHtml(booking.notes)}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Pricing -->
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600;">Price</h4>
          <div style="padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: white;">€${Number(booking.total_price || 0).toFixed(2)}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.9); margin-top: 4px;">Total Price</div>
          </div>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 12px;">
          <button 
            type="button" 
            class="btn-secondary"
            onclick="document.getElementById('tripBookingDetailsModal').hidden=true"
            style="flex: 1;"
          >
            Close
          </button>
          <button 
            type="button" 
            class="btn-danger"
            onclick="deleteTripBooking('${booking.id}')"
            style="flex: 1;"
          >
            🗑️ Delete Booking
          </button>
        </div>
      </div>
    `;

    // Show modal
    modal.hidden = false;

  } catch (e) {
    console.error('Failed to load trip booking details:', e);
    showToast('Failed to load booking details', 'error');
  }
}

// Update trip booking status
async function updateTripBookingStatus(bookingId, newStatus) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const updateData = { 
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Add timestamp for confirmed/cancelled
    if (newStatus === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
    } else if (newStatus === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { error } = await client
      .from('trip_bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;

    showToast(`Status updated to: ${newStatus}`, 'success');
    await loadTripBookingsData(); // Refresh table
    
    // Update badge in modal
    const badge = document.querySelector('#tripBookingDetailsModal .badge');
    if (badge) {
      badge.textContent = newStatus.toUpperCase();
      badge.className = 'badge ' + (
        newStatus === 'confirmed' ? 'badge-success' :
        newStatus === 'pending' ? 'badge-warning' :
        newStatus === 'cancelled' ? 'badge-danger' :
        newStatus === 'completed' ? 'badge-success' : 'badge'
      );
    }

  } catch (e) {
    console.error('Failed to update status:', e);
    showToast('Failed to update status: ' + e.message, 'error');
  }
}

// Delete trip booking
async function deleteTripBooking(bookingId) {
  if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const { error } = await client
      .from('trip_bookings')
      .delete()
      .eq('id', bookingId);

    if (error) throw error;

    showToast('Booking deleted successfully', 'success');
    document.getElementById('tripBookingDetailsModal').hidden = true;
    await loadTripBookingsData(); // Refresh table

  } catch (e) {
    console.error('Failed to delete booking:', e);
    showToast('Failed to delete booking: ' + e.message, 'error');
  }
}

// Export functions
window.viewTripBookingDetails = viewTripBookingDetails;
window.updateTripBookingStatus = updateTripBookingStatus;
window.deleteTripBooking = deleteTripBooking;

// =====================================================
// TRIPS MANAGEMENT
// =====================================================

async function loadTripsAdminData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    // Load trips list
    const { data: trips, error } = await client
      .from('trips')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    // Stats
    const total = trips?.length || 0;
    const published = (trips || []).filter(t => t.is_published).length;
    const statTotal = document.getElementById('tripsStatTotal');
    const statPub = document.getElementById('tripsStatPublished');
    const sub = document.getElementById('tripsStatSubtitle');
    if (statTotal) statTotal.textContent = total;
    if (statPub) statPub.textContent = published;
    if (sub) sub.textContent = total ? `${published} published` : 'No trips yet';

    // Table
    const tbody = document.getElementById('tripsTableBody');
    if (!tbody) return;
    if (!trips || trips.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No trips found</td></tr>';
      return;
    }

    tbody.innerHTML = trips.map(t => {
      const title = (t.title && (t.title.pl || t.title.en)) || t.slug || t.id;
      const updated = t.updated_at ? new Date(t.updated_at).toLocaleString('en-GB') : '-';
      return `
        <tr>
          <td>
            <div style="font-weight:600">${escapeHtml(title)}</div>
            ${t.display_mode ? `<div style=\"font-size:11px;color:var(--admin-text-muted)\">${escapeHtml(t.display_mode)}</div>` : ''}
          </td>
          <td>${escapeHtml(t.slug || '')}</td>
          <td>${escapeHtml(t.start_city || '')}</td>
          <td>
            <label class="admin-switch" title="Toggle publish">
              <input type="checkbox" ${t.is_published ? 'checked' : ''} onchange="toggleTripPublish('${t.id}', this.checked)">
              <span></span>
            </label>
          </td>
          <td>${updated}</td>
          <td style="display:flex;gap:8px;">
            <button class="btn-primary" onclick="editTrip('${t.id}')">Edit</button>
            <a class="btn-secondary" href="/trip.html?slug=${encodeURIComponent(t.slug)}" target="_blank">Preview</a>
          </td>
        </tr>
      `;
    }).join('');

    // Button: New Trip
    const addBtn = document.getElementById('btnAddTrip');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.addEventListener('click', openNewTripModal);
      addBtn.dataset.bound = '1';
    }

    showToast('Trips loaded', 'success');
  } catch (e) {
    console.error('Failed to load trips:', e);
    showToast('Failed to load trips: ' + (e.message || 'Unknown error'), 'error');
    const tbody = document.getElementById('tripsTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="table-loading" style="color:var(--admin-danger)">Error: ${escapeHtml(e.message||'')}</td></tr>`;
  }
}

async function toggleTripPublish(tripId, publish) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    const { error } = await client
      .from('trips')
      .update({ is_published: !!publish, updated_at: new Date().toISOString() })
      .eq('id', tripId);
    if (error) throw error;
    showToast(publish ? 'Trip published' : 'Trip unpublished', 'success');
    await loadTripsAdminData();
  } catch (e) {
    console.error('Publish toggle failed:', e);
    showToast('Failed to update publish state', 'error');
  }
}

async function editTrip(tripId) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    // Fetch trip data
    const { data: trip, error } = await client
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();
    
    if (error) throw error;
    
    // Populate form fields
    const modal = document.getElementById('editTripModal');
    const form = document.getElementById('editTripForm');
    if (!modal || !form) return;
    
    document.getElementById('editTripId').value = trip.id;
    document.getElementById('editTripSlug').value = trip.slug || '';
    document.getElementById('editTripCity').value = trip.start_city || 'Larnaca';
    document.getElementById('editTripCoverUrl').value = trip.cover_image_url || '';
    document.getElementById('editTripPricing').value = trip.pricing_model || 'per_person';
    document.getElementById('editTripPublished').checked = !!trip.is_published;
    
    // Check if we should use i18n fields
    // New trips default to i18n, existing trips use i18n if they have i18n fields
    const useI18n = trip ? (trip.title_i18n || trip.description_i18n) : true;
    const i18nContainer = $('#tripI18nFields');
    const legacyFields = $('#tripLegacyFields');
    
    if (useI18n && i18nContainer && legacyFields && window.renderI18nInput) {
      // Render i18n fields
      const titleContainer = $('#tripTitleI18n');
      const descContainer = $('#tripDescriptionI18n');
      
      if (titleContainer) {
        titleContainer.innerHTML = window.renderI18nInput({
          fieldName: 'title',
          label: 'Title',
          type: 'text',
          placeholder: 'Trip title',
          currentValues: trip?.title_i18n || {}
        });
      }
      
      if (descContainer) {
        descContainer.innerHTML = window.renderI18nInput({
          fieldName: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 4,
          placeholder: 'Trip description',
          currentValues: trip?.description_i18n || {}
        });
      }
      
      // Show i18n container, hide legacy fields
      i18nContainer.style.display = 'block';
      legacyFields.style.display = 'none';
    } else if (legacyFields && i18nContainer) {
      // Use legacy fields
      i18nContainer.style.display = 'none';
      legacyFields.style.display = 'contents';
      
      // Fill legacy fields
      document.getElementById('editTripTitlePl').value = (trip.title && trip.title.pl) || '';
      document.getElementById('editTripDescPl').value = (trip.description && trip.description.pl) || '';
    }
    
    // Show cover preview if URL exists
    const previewWrap = document.getElementById('editTripCoverPreview');
    const previewImg = previewWrap ? previewWrap.querySelector('img') : null;
    if (trip.cover_image_url && previewImg) {
      previewImg.src = trip.cover_image_url;
      previewWrap.style.display = '';
    } else if (previewWrap) {
      previewWrap.style.display = 'none';
    }
    
    // Render price fields based on pricing model
    renderEditTripPriceFields(trip.pricing_model, trip);
    
    // Setup pricing model change listener
    const pricingSelect = document.getElementById('editTripPricing');
    if (pricingSelect) {
      pricingSelect.onchange = (e) => renderEditTripPriceFields(e.target.value, trip);
    }
    
    // Setup cover URL input preview
    const urlInput = document.getElementById('editTripCoverUrl');
    if (urlInput && previewWrap && previewImg) {
      urlInput.oninput = () => {
        const url = (urlInput.value || '').trim();
        if (url) {
          previewImg.src = url;
          previewWrap.style.display = '';
        } else {
          previewWrap.style.display = 'none';
        }
      };
    }
    
    // Setup form submit handler
    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleEditTripSubmit(e, trip);
    };
    
    modal.hidden = false;
  } catch (e) {
    console.error('Failed to open edit modal:', e);
    showToast('Failed to load trip for editing', 'error');
  }
}

function renderEditTripPriceFields(model, trip) {
  const container = document.getElementById('editTripPriceFields');
  if (!container) return;
  
  if (model === 'per_person') {
    container.innerHTML = `
      <label class="admin-form-field"><span>Price per person</span><input name="price_per_person" type="number" step="0.01" value="${trip.price_per_person || ''}" /></label>
    `;
  } else if (model === 'base_plus_extra') {
    container.innerHTML = `
      <label class="admin-form-field"><span>Base price</span><input name="price_base" type="number" step="0.01" value="${trip.price_base || ''}" /></label>
      <label class="admin-form-field"><span>Included people</span><input name="included_people" type="number" step="1" value="${trip.included_people || ''}" /></label>
      <label class="admin-form-field"><span>Extra per person</span><input name="price_extra_person" type="number" step="0.01" value="${trip.price_extra_person || ''}" /></label>
    `;
  } else if (model === 'per_hour') {
    container.innerHTML = `
      <label class="admin-form-field"><span>Price per hour</span><input name="price_base" type="number" step="0.01" value="${trip.price_base || ''}" /></label>
      <label class="admin-form-field"><span>Min hours</span><input name="min_hours" type="number" step="1" value="${trip.min_hours || ''}" /></label>
    `;
  } else if (model === 'per_day') {
    container.innerHTML = `
      <label class="admin-form-field"><span>Price per day</span><input name="price_base" type="number" step="0.01" value="${trip.price_base || ''}" /></label>
    `;
  } else {
    container.innerHTML = '';
  }
}

async function handleEditTripSubmit(event, originalTrip) {
  event.preventDefault();
  
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    
    const form = event.target;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    
    // Normalize types
    ['price_base', 'price_per_person', 'price_extra_person', 'included_people', 'min_hours'].forEach(k => {
      if (payload[k] === '' || payload[k] == null) delete payload[k];
      else payload[k] = Number(payload[k]);
    });
    
    // Check if using i18n fields
    const usingI18n = $('#tripI18nFields')?.style.display !== 'none';
    
    if (usingI18n && window.extractI18nValues) {
      // Extract i18n values
      const titleI18n = window.extractI18nValues(fd, 'title');
      const descriptionI18n = window.extractI18nValues(fd, 'description');
      
      // Validate i18n fields
      const titleError = window.validateI18nField(titleI18n, 'Title');
      if (titleError) {
        throw new Error(titleError);
      }
      
      // Save i18n fields
      payload.title_i18n = titleI18n;
      payload.description_i18n = descriptionI18n;
      
      // Backward compatibility - use Polish version
      payload.title = { pl: titleI18n?.pl || '' };
      payload.description = { pl: descriptionI18n?.pl || '' };
    } else {
      // Use legacy fields
      payload.title = { pl: payload.title_pl || '' };
      payload.description = { pl: payload.description_pl || '' };
      delete payload.title_pl;
      delete payload.description_pl;
    }
    
    // Handle is_published checkbox
    payload.is_published = form.querySelector('#editTripPublished').checked;
    
    // Update timestamp
    payload.updated_at = new Date().toISOString();
    
    const tripId = document.getElementById('editTripId').value;
    
    // Update via Supabase client
    const { error } = await client
      .from('trips')
      .update(payload)
      .eq('id', tripId);
    
    if (error) throw error;
    
    showToast('Trip updated successfully', 'success');
    document.getElementById('editTripModal').hidden = true;
    await loadTripsAdminData();
    
  } catch (err) {
    console.error('Failed to update trip:', err);
    showToast(err.message || 'Failed to update trip', 'error');
  }
}

// expose trip helpers for inline handlers
window.toggleTripPublish = toggleTripPublish;
window.editTrip = editTrip;

// =====================================================
// NEW TRIP MODAL (create + link to POI)
// =====================================================

function renderNewTripPriceFields(model) {
  const c = document.getElementById('newTripPriceFields');
  if (!c) return;
  if (model === 'per_person') {
    c.innerHTML = `
      <label class="admin-form-field"><span>Price per person</span><input name="price_per_person" type="number" step="0.01" /></label>
    `;
  } else if (model === 'base_plus_extra') {
    c.innerHTML = `
      <label class="admin-form-field"><span>Base price</span><input name="price_base" type="number" step="0.01" /></label>
      <label class="admin-form-field"><span>Included people</span><input name="included_people" type="number" step="1" /></label>
      <label class="admin-form-field"><span>Extra per person</span><input name="price_extra_person" type="number" step="0.01" /></label>
    `;
  } else if (model === 'per_hour') {
    c.innerHTML = `
      <label class="admin-form-field"><span>Price per hour</span><input name="price_base" type="number" step="0.01" /></label>
      <label class="admin-form-field"><span>Min hours</span><input name="min_hours" type="number" step="1" /></label>
    `;
  } else if (model === 'per_day') {
    c.innerHTML = `
      <label class="admin-form-field"><span>Price per day</span><input name="price_base" type="number" step="0.01" /></label>
    `;
  } else {
    c.innerHTML = '';
  }
}

function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || `trip-${Date.now()}`;
}

function compressToWebp(file, maxWidth = 1920, maxHeight = 1080, quality = 0.82) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Compression failed'));
            const out = new File([blob], (file.name.split('.')[0] || 'cover') + '.webp', { type: 'image/webp' });
            resolve(out);
          }, 'image/webp', quality);
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Read error'));
      reader.readAsDataURL(file);
    } catch (e) { reject(e); }
  });
}

async function openNewTripModal() {
  try {
    // Defaults
    const pricingSel = document.getElementById('newTripPricing');
    if (pricingSel) {
      renderNewTripPriceFields(pricingSel.value || 'per_person');
      pricingSel.onchange = (e) => renderNewTripPriceFields(e.target.value);
    }

    const form = document.getElementById('newTripForm');
    if (form) {
      // reset fields
      form.reset();
      // cover preview setup
      const fileInput = document.getElementById('newTripCoverFile');
      const urlInput = document.getElementById('newTripCoverUrl');
      const previewWrap = document.getElementById('newTripCoverPreview');
      const previewImg = previewWrap ? previewWrap.querySelector('img') : null;
      if (fileInput && previewWrap && previewImg) {
        fileInput.onchange = () => {
          const f = fileInput.files && fileInput.files[0];
          if (f && f.type && f.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
              previewImg.src = reader.result;
              previewWrap.style.display = '';
            };
            reader.readAsDataURL(f);
            // Clear URL if file chosen
            if (urlInput) urlInput.value = '';
          } else {
            previewWrap.style.display = 'none';
            previewImg.removeAttribute('src');
          }
        };
      }
      if (urlInput && previewWrap && previewImg) {
        urlInput.oninput = () => {
          const v = (urlInput.value || '').trim();
          if (v) {
            previewImg.src = v;
            previewWrap.style.display = '';
            if (fileInput) fileInput.value = '';
          } else {
            previewWrap.style.display = 'none';
            previewImg.removeAttribute('src');
          }
        };
      }
      // Pricing tiers editor init
      renderPricingTiers('newHotelPricingTiersBody', []);
      const btnAddNewTier = document.getElementById('btnAddNewHotelTier');
      if (btnAddNewTier && !btnAddNewTier.dataset.bound) {
        btnAddNewTier.addEventListener('click', () => addPricingTierRow('newHotelPricingTiersBody'));
        btnAddNewTier.dataset.bound = '1';
      }

      // Photos multiple preview
      const multiPhotos = document.getElementById('newHotelPhotos');
      const multiPreview = document.getElementById('newHotelPhotosPreview');
      if (multiPhotos && multiPreview) {
        multiPhotos.onchange = () => previewLocalImages(multiPhotos, multiPreview, 10);
      }

      form.onsubmit = async (ev) => {
        ev.preventDefault();
        try {
          const client = ensureSupabase();
          if (!client) throw new Error('Database connection not available');

          const fd = new FormData(form);
          const payload = Object.fromEntries(fd.entries());
          
          // Normalize types
          ['price_base','price_per_person','price_extra_person','included_people','min_hours'].forEach(k=>{
            if (payload[k] === '' || payload[k] == null) delete payload[k];
            else payload[k] = Number(payload[k]);
          });
          
          payload.title = { pl: payload.title_pl || '' };
          payload.description = { pl: payload.description_pl || '' };
          delete payload.title_pl; 
          delete payload.description_pl;
          
          // Auto-generate slug from title
          payload.slug = slugifyTitle(payload.title.pl);

          // Optional direct upload of cover image to Storage
          let coverUrl = (payload.cover_image_url || '').trim() || '';
          const file = fileInput && fileInput.files ? fileInput.files[0] : null;
          if (file) {
            if (!file.type.startsWith('image/')) throw new Error('Nieprawidłowy typ pliku okładki');
            const maxSize = 8 * 1024 * 1024;
            if (file.size > maxSize) throw new Error('Plik okładki jest za duży (max 8MB)');
            
            const compressed = await compressToWebp(file, 1920, 1080, 0.82);
            const path = `trips/${payload.slug}/cover-${Date.now()}.webp`;
            const { error: upErr } = await client.storage.from('poi-photos').upload(path, compressed, { 
              cacheControl: '3600', 
              upsert: false, 
              contentType: 'image/webp' 
            });
            if (upErr) throw upErr;
            
            const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
            coverUrl = pub?.publicUrl || '';
          }
          if (coverUrl) payload.cover_image_url = coverUrl; 
          else delete payload.cover_image_url;

          // Set timestamps
          const now = new Date().toISOString();
          payload.created_at = now;
          payload.updated_at = now;
          payload.is_published = false; // New trips start as drafts

          // Insert directly via Supabase client (like Cars does)
          const { data, error } = await client
            .from('trips')
            .insert(payload)
            .select('*')
            .single();

          if (error) throw error;

          showToast('Trip created successfully', 'success');
          document.getElementById('newTripModal').hidden = true;
          await loadTripsAdminData();
          
        } catch (err) {
          console.error('Create trip failed:', err);
          showToast(err.message || 'Failed to create trip', 'error');
        }
      };
    }

    const modal = document.getElementById('newTripModal');
    if (modal) modal.hidden = false;
  } catch (e) {
    console.error('openNewTripModal failed', e);
    showToast('Failed to open New Trip', 'error');
  }
}

// =====================================================
// HOTELS MANAGEMENT (mirrors Trips)
// =====================================================

async function loadHotelsAdminData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const { data: hotels, error } = await client
      .from('hotels')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const total = hotels?.length || 0;
    const published = (hotels || []).filter(h => h.is_published).length;
    const statTotal = document.getElementById('hotelsStatTotal');
    const statPub = document.getElementById('hotelsStatPublished');
    const sub = document.getElementById('hotelsStatSubtitle');
    if (statTotal) statTotal.textContent = total;
    if (statPub) statPub.textContent = published;
    if (sub) sub.textContent = total ? `${published} published` : 'No hotels yet';

    const tbody = document.getElementById('hotelsTableBody');
    if (!tbody) return;
    if (!hotels || hotels.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No hotels found</td></tr>';
      return;
    }

    function formatHotelPriceSummary(h) {
      try {
        const tiers = h.pricing_tiers && h.pricing_tiers.rules ? h.pricing_tiers.rules : [];
        if (!tiers || tiers.length === 0) return '-';
        // prefer price for 2 persons, otherwise min price
        const by2 = tiers.find(t => Number(t.persons) === 2 && t.price_per_night != null);
        const price = by2 ? Number(by2.price_per_night) : Math.min(...tiers.map(t => Number(t.price_per_night || Infinity)));
        if (!isFinite(price)) return '-';
        return `€${price.toFixed(2)}/night`;
      } catch (_) { return '-'; }
    }

    tbody.innerHTML = hotels.map(h => {
      const title = (h.title && (h.title.pl || h.title.en)) || h.slug || h.id;
      const updated = h.updated_at ? new Date(h.updated_at).toLocaleString('en-GB') : '-';
      const priceSummary = formatHotelPriceSummary(h);
      return `
        <tr>
          <td>
            <div style="font-weight:600">${escapeHtml(title)}</div>
          </td>
          <td>${escapeHtml(h.slug || '')}</td>
          <td>${escapeHtml(h.city || '')}</td>
          <td>${escapeHtml(priceSummary)}</td>
          <td>
            <label class="admin-switch" title="Toggle publish">
              <input type="checkbox" ${h.is_published ? 'checked' : ''} onchange="toggleHotelPublish('${h.id}', this.checked)">
              <span></span>
            </label>
          </td>
          <td>${updated}</td>
          <td style="display:flex;gap:8px;">
            <button class="btn-primary" onclick="editHotel('${h.id}')">Edit</button>
            <a class="btn-secondary" href="/hotel.html?slug=${encodeURIComponent(h.slug)}" target="_blank">Preview</a>
          </td>
        </tr>
      `;
    }).join('');

    const addBtn = document.getElementById('btnAddHotel');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.addEventListener('click', openNewHotelModal);
      addBtn.dataset.bound = '1';
    }

    showToast('Hotels loaded', 'success');
  } catch (e) {
    console.error('Failed to load hotels:', e);
    showToast('Failed to load hotels: ' + (e.message || 'Unknown error'), 'error');
    const tbody = document.getElementById('hotelsTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="table-loading" style="color:var(--admin-danger)">Error: ${escapeHtml(e.message||'')}</td></tr>`;
  }
}

async function toggleHotelPublish(hotelId, publish) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    const { error } = await client
      .from('hotels')
      .update({ is_published: !!publish, updated_at: new Date().toISOString() })
      .eq('id', hotelId);
    if (error) throw error;
    showToast(publish ? 'Hotel published' : 'Hotel unpublished', 'success');
    await loadHotelsAdminData();
  } catch (e) {
    console.error('Publish toggle failed:', e);
    showToast('Failed to update publish state', 'error');
  }
}

async function editHotel(hotelId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { data: hotel, error } = await client
      .from('hotels')
      .select('*')
      .eq('id', hotelId)
      .single();

    if (error) throw error;

    const modal = document.getElementById('editHotelModal');
    const form = document.getElementById('editHotelForm');
    if (!modal || !form) return;

    document.getElementById('editHotelId').value = hotel.id;
    document.getElementById('editHotelSlug').value = hotel.slug || '';
    document.getElementById('editHotelCity').value = hotel.city || 'Larnaca';
    document.getElementById('editHotelTitlePl').value = (hotel.title && hotel.title.pl) || '';
    document.getElementById('editHotelDescPl').value = (hotel.description && hotel.description.pl) || '';
    document.getElementById('editHotelCoverUrl').value = hotel.cover_image_url || '';
    document.getElementById('editHotelPricing').value = hotel.pricing_model || 'per_person_per_night';
    document.getElementById('editHotelPublished').checked = !!hotel.is_published;

    const previewWrap = document.getElementById('editHotelCoverPreview');
    const previewImg = previewWrap ? previewWrap.querySelector('img') : null;
    if (hotel.cover_image_url && previewImg) {
      previewImg.src = hotel.cover_image_url;
      previewWrap.style.display = '';
    } else if (previewWrap) {
      previewWrap.style.display = 'none';
    }

    const urlInput = document.getElementById('editHotelCoverUrl');
    if (urlInput && previewWrap && previewImg) {
      urlInput.oninput = () => {
        const url = (urlInput.value || '').trim();
        if (url) {
          previewImg.src = url;
          previewWrap.style.display = '';
        } else {
          previewWrap.style.display = 'none';
        }
      };
    }

    // Pricing tiers populate
    renderPricingTiers('editHotelPricingTiersBody', hotel.pricing_tiers && hotel.pricing_tiers.rules ? hotel.pricing_tiers.rules : []);
    const btnAddEditTier = document.getElementById('btnAddEditHotelTier');
    if (btnAddEditTier && btnAddEditTier.dataset.boundFor !== hotel.id) {
      btnAddEditTier.addEventListener('click', () => addPricingTierRow('editHotelPricingTiersBody'));
      btnAddEditTier.dataset.boundFor = hotel.id;
    }

    // Max persons
    const maxPersonsEl = document.getElementById('editHotelMaxPersons');
    if (maxPersonsEl) {
      maxPersonsEl.value = hotel.max_persons != null ? Number(hotel.max_persons) : '';
    }

    // Photos preview existing
    const photosWrap = document.getElementById('editHotelPhotosPreview');
    if (photosWrap) {
      photosWrap.innerHTML = '';
      const photos = Array.isArray(hotel.photos) ? hotel.photos : [];
      photos.slice(0, 10).forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'photo';
        img.style.width = '72px';
        img.style.height = '72px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '6px';
        img.loading = 'lazy';
        photosWrap.appendChild(img);
      });
    }

    // Bind file input for extra photos
    const editPhotosInput = document.getElementById('editHotelPhotos');
    if (editPhotosInput && photosWrap) {
      editPhotosInput.onchange = () => previewLocalImages(editPhotosInput, photosWrap, 10);
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleEditHotelSubmit(e, hotel);
    };

    modal.hidden = false;
  } catch (e) {
    console.error('Failed to open edit hotel modal:', e);
    showToast('Failed to load hotel for editing', 'error');
  }
}

async function handleEditHotelSubmit(event, originalHotel) {
  event.preventDefault();
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    const form = event.target;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    payload.title = { pl: payload.title_pl || '' };
    payload.description = { pl: payload.description_pl || '' };
    delete payload.title_pl;
    delete payload.description_pl;

    payload.is_published = form.querySelector('#editHotelPublished').checked;
    payload.updated_at = new Date().toISOString();

    const hotelId = document.getElementById('editHotelId').value;

    // pricing tiers
    payload.pricing_tiers = collectPricingTiers('editHotelPricingTiersBody');

    // max persons
    const maxP = document.getElementById('editHotelMaxPersons');
    if (maxP && maxP.value) {
      const v = Number(maxP.value);
      payload.max_persons = Number.isFinite(v) && v > 0 ? v : null;
    } else {
      payload.max_persons = null;
    }

    // Photos: start with existing
    let existingPhotos = Array.isArray(originalHotel.photos) ? originalHotel.photos.slice(0, 10) : [];
    const addFilesInput = document.getElementById('editHotelPhotos');
    if (addFilesInput && addFilesInput.files && addFilesInput.files.length) {
      const toUpload = Array.from(addFilesInput.files).slice(0, Math.max(0, 10 - existingPhotos.length));
      const newUrls = await uploadHotelPhotosBatch(payload.slug || originalHotel.slug, toUpload);
      existingPhotos = existingPhotos.concat(newUrls).slice(0, 10);
    }
    payload.photos = existingPhotos;

    const { error } = await client
      .from('hotels')
      .update(payload)
      .eq('id', hotelId);

    if (error) throw error;

    showToast('Hotel updated successfully', 'success');
    document.getElementById('editHotelModal').hidden = true;
    await loadHotelsAdminData();
  } catch (err) {
    console.error('Failed to update hotel:', err);
    showToast(err.message || 'Failed to update hotel', 'error');
  }
}

function slugifyHotelTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || `hotel-${Date.now()}`;
}

async function openNewHotelModal() {
  try {
    const form = document.getElementById('newHotelForm');
    if (form) {
      form.reset();

      const fileInput = document.getElementById('newHotelCoverFile');
      const urlInput = document.getElementById('newHotelCoverUrl');
      const previewWrap = document.getElementById('newHotelCoverPreview');
      const previewImg = previewWrap ? previewWrap.querySelector('img') : null;

      if (fileInput && previewWrap && previewImg) {
        fileInput.onchange = () => {
          const f = fileInput.files && fileInput.files[0];
          if (f && f.type && f.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
              previewImg.src = reader.result;
              previewWrap.style.display = '';
            };
            reader.readAsDataURL(f);
            if (urlInput) urlInput.value = '';
          } else {
            previewWrap.style.display = 'none';
            previewImg.removeAttribute('src');
          }
        };
      }
      if (urlInput && previewWrap && previewImg) {
        urlInput.oninput = () => {
          const v = (urlInput.value || '').trim();
          if (v) {
            previewImg.src = v;
            previewWrap.style.display = '';
            if (fileInput) fileInput.value = '';
          } else {
            previewWrap.style.display = 'none';
            previewImg.removeAttribute('src');
          }
        };
      }

      form.onsubmit = async (ev) => {
        ev.preventDefault();
        try {
          const client = ensureSupabase();
          if (!client) throw new Error('Database connection not available');

          const fd = new FormData(form);
          const payload = Object.fromEntries(fd.entries());

          payload.title = { pl: payload.title_pl || '' };
          payload.description = { pl: payload.description_pl || '' };
          delete payload.title_pl;
          delete payload.description_pl;

          payload.slug = slugifyHotelTitle(payload.title.pl);

          let coverUrl = (payload.cover_image_url || '').trim() || '';
          const file = fileInput && fileInput.files ? fileInput.files[0] : null;
          if (file) {
            if (!file.type.startsWith('image/')) throw new Error('Nieprawidłowy typ pliku okładki');
            const maxSize = 8 * 1024 * 1024;
            if (file.size > maxSize) throw new Error('Plik okładki jest za duży (max 8MB)');

            const compressed = await compressToWebp(file, 1920, 1080, 0.82);
            const path = `hotels/${payload.slug}/cover-${Date.now()}.webp`;
            const { error: upErr } = await client.storage.from('poi-photos').upload(path, compressed, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'image/webp'
            });
            if (upErr) throw upErr;

            const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
            coverUrl = pub?.publicUrl || '';
          }
          if (coverUrl) payload.cover_image_url = coverUrl; else delete payload.cover_image_url;

          // pricing tiers
          payload.pricing_tiers = collectPricingTiers('newHotelPricingTiersBody');

          // max persons
          const maxPNew = document.getElementById('newHotelMaxPersons');
          if (maxPNew && maxPNew.value) {
            const v = Number(maxPNew.value);
            payload.max_persons = Number.isFinite(v) && v > 0 ? v : null;
          }

          // multi photos upload (up to 10)
          const photosInput = document.getElementById('newHotelPhotos');
          let photosUrls = [];
          if (photosInput && photosInput.files && photosInput.files.length) {
            const files = Array.from(photosInput.files).slice(0, 10);
            photosUrls = await uploadHotelPhotosBatch(payload.slug, files);
          }
          if (photosUrls.length) payload.photos = photosUrls;

          const now = new Date().toISOString();
          payload.created_at = now;
          payload.updated_at = now;
          payload.is_published = false;

          const { data, error } = await client
            .from('hotels')
            .insert(payload)
            .select('*')
            .single();

          if (error) throw error;

          showToast('Hotel created successfully', 'success');
          document.getElementById('newHotelModal').hidden = true;
          await loadHotelsAdminData();
        } catch (err) {
          console.error('Create hotel failed:', err);
          showToast(err.message || 'Failed to create hotel', 'error');
        }
      };
    }

    const modal = document.getElementById('newHotelModal');
    if (modal) modal.hidden = false;
  } catch (e) {
    console.error('openNewHotelModal failed', e);
    showToast('Failed to open New Hotel', 'error');
  }
}

// =====================================================
// HOTEL BOOKINGS MODULE (mirrors Trip bookings)
// =====================================================

async function loadHotelBookingsData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const { data: bookings, error } = await client
      .from('hotel_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const totalBookings = bookings?.length || 0;
    const pendingBookings = bookings?.filter(b => b.status === 'pending').length || 0;
    const confirmedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0;
    const totalRevenue = bookings
      ?.filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.total_price)
      .reduce((sum, b) => sum + parseFloat(b.total_price), 0) || 0;

    const statTotal = document.getElementById('statHotelBookingsTotal');
    const statPending = document.getElementById('statHotelBookingsPending');
    const statConfirmed = document.getElementById('statHotelBookingsConfirmed');
    const statRevenue = document.getElementById('statHotelBookingsRevenue');

    if (statTotal) statTotal.textContent = totalBookings;
    if (statPending) statPending.textContent = pendingBookings;
    if (statConfirmed) statConfirmed.textContent = confirmedBookings;
    if (statRevenue) statRevenue.textContent = `€${totalRevenue.toFixed(2)}`;

    const tableBody = document.getElementById('hotelBookingsTableBody');
    if (!tableBody) return;

    if (!bookings || bookings.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading">
            No hotel bookings yet. System is ready to accept bookings!
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = bookings.map(booking => {
      const statusClass = 
        booking.status === 'confirmed' ? 'badge-success' :
        booking.status === 'completed' ? 'badge-success' :
        booking.status === 'pending' ? 'badge-warning' :
        booking.status === 'cancelled' ? 'badge-danger' : 'badge';
      const arr = booking.arrival_date ? new Date(booking.arrival_date).toLocaleDateString('en-GB') : '';
      const dep = booking.departure_date ? new Date(booking.departure_date).toLocaleDateString('en-GB') : '';
      return `
        <tr>
          <td>
            <div style="font-weight: 600;">#${booking.id.slice(0, 8).toUpperCase()}</div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${escapeHtml(booking.hotel_slug || 'N/A')}
            </div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(booking.customer_name || 'N/A')}</div>
            <div style="font-size: 12px; color: var(--admin-text-muted);">${escapeHtml(booking.customer_email || '')}</div>
            ${booking.customer_phone ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(booking.customer_phone)}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 12px;">
              ${arr && dep ? `🏨 ${arr} - ${dep}` : 'No dates'}
            </div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${booking.num_adults || booking.num_children ? `👥 ${booking.num_adults || 0}+${booking.num_children || 0}` : ''}
              ${booking.nights ? ` 📅 ${booking.nights} night(s)` : ''}
            </div>
          </td>
          <td>
            <span class="badge ${statusClass}">${(booking.status || 'unknown').toUpperCase()}</span>
          </td>
          <td style="font-weight: 600; color: var(--admin-success);">
            €${Number(booking.total_price || 0).toFixed(2)}
          </td>
          <td>
            <button class="btn-secondary" onclick="viewHotelBookingDetails('${booking.id}')" title="View details">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');

    showToast('Hotel bookings loaded successfully', 'success');

  } catch (error) {
    console.error('Failed to load hotel bookings:', error);
    showToast('Failed to load hotel bookings: ' + (error.message || 'Unknown error'), 'error');
    const tableBody = document.getElementById('hotelBookingsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading" style="color: var(--admin-danger);">
            ❌ Error loading data: ${escapeHtml(error.message || 'Unknown error')}
            <br><small style="margin-top: 8px; display: block;">
              Make sure the hotel tables exist in Supabase.
            </small>
          </td>
        </tr>
      `;
    }
  }
}

async function viewHotelBookingDetails(bookingId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { data: booking, error } = await client
      .from('hotel_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      showToast('Failed to load booking details', 'error');
      return;
    }
    if (!booking) {
      showToast('Booking not found', 'error');
      return;
    }

    const modal = document.getElementById('hotelBookingDetailsModal');
    const content = document.getElementById('hotelBookingDetailsContent');
    if (!modal || !content) return;

    const arrivalDate = booking.arrival_date ? new Date(booking.arrival_date).toLocaleDateString('en-GB') : 'N/A';
    const departureDate = booking.departure_date ? new Date(booking.departure_date).toLocaleDateString('en-GB') : 'N/A';
    const createdAt = booking.created_at ? new Date(booking.created_at).toLocaleString('en-GB') : 'N/A';
    const statusClass = 
      booking.status === 'confirmed' ? 'badge-success' :
      booking.status === 'pending' ? 'badge-warning' :
      booking.status === 'cancelled' ? 'badge-danger' :
      booking.status === 'completed' ? 'badge-success' : 'badge';

    content.innerHTML = `
      <div style="display: grid; gap: 24px;">
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 600;">Booking #${booking.id.slice(0, 8).toUpperCase()}</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: var(--admin-text-muted);">Hotel: ${escapeHtml(booking.hotel_slug || 'N/A')}</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: var(--admin-text-muted);">Created: ${createdAt}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <select id="hotelBookingStatusDropdown" class="admin-form-field" style="padding: 8px 12px; font-size: 14px; font-weight: 600;" onchange="updateHotelBookingStatus('${booking.id}', this.value)">
                <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
                <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>✔️ Completed</option>
                <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
              </select>
              <span class="badge ${statusClass}" style="font-size: 14px; padding: 6px 12px;">${(booking.status || 'pending').toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Customer Information</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Name:</span>
              <span>${escapeHtml(booking.customer_name || 'N/A')}</span>
            </div>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Email:</span>
              <span><a href="mailto:${escapeHtml(booking.customer_email)}">${escapeHtml(booking.customer_email || 'N/A')}</a></span>
            </div>
            ${booking.customer_phone ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Phone:</span>
              <span><a href="tel:${escapeHtml(booking.customer_phone)}">${escapeHtml(booking.customer_phone)}</a></span>
            </div>
            ` : ''}
          </div>
        </div>

        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Stay Details</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Stay:</span>
              <span>🏨 ${arrivalDate} → ${departureDate}</span>
            </div>
            ${booking.num_adults ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Guests:</span>
              <span>👥 ${booking.num_adults} adult(s), ${booking.num_children || 0} child(ren)</span>
            </div>
            ` : ''}
            ${booking.nights ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Nights:</span>
              <span>📅 ${booking.nights}</span>
            </div>
            ` : ''}
            ${booking.notes ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Notes:</span>
              <span>${escapeHtml(booking.notes)}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600;">Price</h4>
          <div style="padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: white;">€${Number(booking.total_price || 0).toFixed(2)}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.9); margin-top: 4px;">Total Price</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px;">
          <button type="button" class="btn-secondary" onclick="document.getElementById('hotelBookingDetailsModal').hidden=true" style="flex: 1;">Close</button>
          <button type="button" class="btn-danger" onclick="deleteHotelBooking('${booking.id}')" style="flex: 1;">🗑️ Delete Booking</button>
        </div>
      </div>
    `;

    modal.hidden = false;
  } catch (e) {
    console.error('Failed to load hotel booking details:', e);
    showToast('Failed to load booking details', 'error');
  }
}

async function updateHotelBookingStatus(bookingId, newStatus) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const updateData = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'confirmed') updateData.confirmed_at = new Date().toISOString();
    else if (newStatus === 'cancelled') updateData.cancelled_at = new Date().toISOString();

    const { error } = await client
      .from('hotel_bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;
    showToast(`Status updated to: ${newStatus}`, 'success');
    await loadHotelBookingsData();

    const badge = document.querySelector('#hotelBookingDetailsModal .badge');
    if (badge) {
      badge.textContent = newStatus.toUpperCase();
      badge.className = 'badge ' + (
        newStatus === 'confirmed' ? 'badge-success' :
        newStatus === 'pending' ? 'badge-warning' :
        newStatus === 'cancelled' ? 'badge-danger' :
        newStatus === 'completed' ? 'badge-success' : 'badge'
      );
    }
  } catch (e) {
    console.error('Failed to update status:', e);
    showToast('Failed to update status: ' + e.message, 'error');
  }
}

async function deleteHotelBooking(bookingId) {
  if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
    return;
  }
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    const { error } = await client
      .from('hotel_bookings')
      .delete()
      .eq('id', bookingId);
    if (error) throw error;
    showToast('Booking deleted successfully', 'success');
    document.getElementById('hotelBookingDetailsModal').hidden = true;
    await loadHotelBookingsData();
  } catch (e) {
    console.error('Failed to delete booking:', e);
    showToast('Failed to delete booking: ' + e.message, 'error');
  }
}

// Expose for inline handlers
window.toggleHotelPublish = toggleHotelPublish;
window.editHotel = editHotel;
window.openNewHotelModal = openNewHotelModal;
window.viewHotelBookingDetails = viewHotelBookingDetails;
window.updateHotelBookingStatus = updateHotelBookingStatus;
window.deleteHotelBooking = deleteHotelBooking;

function addPricingTierRow(tbodyId, tier) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (tbody.querySelector('.table-loading')) tbody.innerHTML = '';
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" min="1" class="admin-input" style="width:100px" value="${tier && tier.persons != null ? Number(tier.persons) : ''}" placeholder="2" /></td>
    <td><input type="number" min="0" step="0.01" class="admin-input" style="width:140px" value="${tier && tier.price_per_night != null ? Number(tier.price_per_night) : ''}" placeholder="0.00" /></td>
    <td><input type="number" min="1" class="admin-input" style="width:140px" value="${tier && tier.min_nights != null ? Number(tier.min_nights) : ''}" placeholder="" /></td>
    <td><button type="button" class="btn-danger">Remove</button></td>
  `;
  const btn = tr.querySelector('button');
  btn.addEventListener('click', () => {
    tr.remove();
    if (!tbody.children.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-loading">No tiers yet</td></tr>';
    }
  });
  tbody.appendChild(tr);
}

function renderPricingTiers(tbodyId, rules) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';
  const list = Array.isArray(rules) ? rules : [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-loading">No tiers yet</td></tr>';
    return;
  }
  list.forEach(r => addPricingTierRow(tbodyId, r));
}

function collectPricingTiers(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return { currency: 'EUR', rules: [] };
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const rules = [];
  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (!inputs || inputs.length < 2) return;
    const persons = Number(inputs[0].value);
    const price = Number(inputs[1].value);
    const minNights = inputs[2] && inputs[2].value ? Number(inputs[2].value) : null;
    if (Number.isFinite(persons) && persons > 0 && Number.isFinite(price) && price >= 0) {
      const rule = { persons, price_per_night: price };
      if (Number.isFinite(minNights) && minNights > 0) rule.min_nights = minNights;
      rules.push(rule);
    }
  });
  rules.sort((a, b) => a.persons - b.persons);
  return { currency: 'EUR', rules };
}

function previewLocalImages(fileInput, container, max = 10) {
  container.innerHTML = '';
  if (!fileInput || !fileInput.files) return;
  const files = Array.from(fileInput.files).slice(0, max);
  files.forEach(f => {
    if (!f.type.startsWith('image/')) return;
    const img = document.createElement('img');
    img.alt = f.name;
    img.style.width = '72px';
    img.style.height = '72px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.readAsDataURL(f);
    container.appendChild(img);
  });
}

async function uploadHotelPhotosBatch(slug, files) {
  const client = ensureSupabase();
  if (!client) throw new Error('Database connection not available');
  const results = [];
  for (const file of files) {
    if (!file || !file.type || !file.type.startsWith('image/')) continue;
    const compressed = await compressToWebp(file, 1600, 1200, 0.82);
    const path = `hotels/${slug}/gallery/${Date.now()}-${Math.random().toString(36).slice(2,8)}.webp`;
    const { error: upErr } = await client.storage.from('poi-photos').upload(path, compressed, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/webp'
    });
    if (upErr) throw upErr;
    const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
    if (pub && pub.publicUrl) results.push(pub.publicUrl);
  }
  return results;
}

window.openNewTripModal = openNewTripModal;

function hideElement(element) {
  if (element) {
    element.hidden = true;
    element.style.display = 'none';
  }
}

function setLoading(isLoading) {
  adminState.loading = isLoading;
  const loadingEl = $('#adminLoading');
  if (isLoading) {
    showElement(loadingEl);
  } else {
    hideElement(loadingEl);
  }
}

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================

function showToast(message, type = 'info') {
  // Use existing toast system if available
  if (window.showToast) {
    window.showToast(message, type);
    return;
  }

  // Fallback toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =====================================================
// AUTHENTICATION & ACCESS CONTROL
// =====================================================

async function checkAdminAccess() {
  try {
    console.log('=== checkAdminAccess START ===');
    setLoading(true);

    // Ensure Supabase client is available
    if (!sb) {
      sb = getSupabaseClient();
    }
    
    if (!sb) {
      throw new Error('Supabase client not available');
    }

    // Get current session
    console.log('Getting session...');
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      throw sessionError;
    }
    
    if (!session || !session.user) {
      console.log('No active session - showing login screen');
      showLoginScreen();
      return false;
    }

    console.log('Session found. User:', session.user.email, 'ID:', session.user.id);
    adminState.user = session.user;

    // Check if user ID matches admin
    console.log('Required admin ID:', ADMIN_CONFIG.requiredUserId);
    console.log('Current user ID:', session.user.id);
    
    if (session.user.id !== ADMIN_CONFIG.requiredUserId) {
      console.log('❌ User ID does NOT match admin ID');
      console.log('User is not admin:', session.user.id);
      showAccessDenied();
      return false;
    }
    
    console.log('✅ User ID matches! Checking profile...');

    // Get user profile and verify is_admin flag
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }

    console.log('Profile loaded:', profile);
    console.log('is_admin flag:', profile?.is_admin);

    if (!profile || !profile.is_admin) {
      console.log('❌ User profile does not have admin flag');
      showAccessDenied();
      return false;
    }

    console.log('✅ Admin flag confirmed!');
    adminState.profile = profile;
    adminState.isAdmin = true;

    console.log('✅✅✅ Admin access GRANTED:', profile.username || profile.email);
    console.log('=== checkAdminAccess END - SUCCESS ===');
    showAdminPanel();
    return true;

  } catch (error) {
    console.error('❌ Admin access check failed:', error);
    console.log('=== checkAdminAccess END - FAILED ===');
    showLoginScreen();
    return false;
  } finally {
    setLoading(false);
  }
}

function showLoginScreen() {
  console.log('showLoginScreen() called');
  
  const loading = $('#adminLoading');
  const accessDenied = $('#adminAccessDenied');
  const container = $('#adminContainer');
  const loginScreen = $('#adminLoginScreen');
  
  console.log('Elements:', {
    loading: !!loading,
    accessDenied: !!accessDenied,
    container: !!container,
    loginScreen: !!loginScreen
  });
  
  hideElement(loading);
  hideElement(accessDenied);
  hideElement(container);
  showElement(loginScreen);
  
  console.log('Login screen should now be visible');
}

function showAccessDenied() {
  hideElement($('#adminLoading'));
  hideElement($('#adminLoginScreen'));
  hideElement($('#adminContainer'));
  showElement($('#adminAccessDenied'));
}

function showAdminPanel() {
  hideElement($('#adminLoading'));
  hideElement($('#adminLoginScreen'));
  hideElement($('#adminAccessDenied'));
  showElement($('#adminContainer'));
  
  // Update admin info in header
  updateAdminHeader();
  
  // Load initial data
  loadDashboardData();
}

function updateAdminHeader() {
  const nameEl = $('#adminUserName');
  if (nameEl && adminState.profile) {
    nameEl.textContent = adminState.profile.username || adminState.profile.name || adminState.user.email;
  }
}

// =====================================================
// NAVIGATION
// =====================================================

function switchView(viewName) {
  // Update state
  adminState.currentView = viewName;

  // Update nav items
  $$('.admin-nav-item').forEach(item => {
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update views
  $$('.admin-view').forEach(view => {
    if (view.id === `view${viewName.charAt(0).toUpperCase()}${viewName.slice(1)}`) {
      view.classList.add('active');
      view.hidden = false;
    } else {
      view.classList.remove('active');
      view.hidden = true;
    }
  });

  // Update breadcrumb
  const breadcrumb = $('#breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `<span>${viewName.charAt(0).toUpperCase()}${viewName.slice(1)}</span>`;
  }

  // Load view-specific data
  switch (viewName) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'users':
      loadUsersData();
      break;
    case 'pois':
      loadPoisData();
      break;
    case 'quests':
      loadQuestsData();
      break;
    case 'cars':
      loadCarsData();
      break;
    case 'trips':
      loadTripsAdminData();
      break;
    case 'hotels':
      loadHotelsAdminData();
      break;
    case 'content':
      loadContentData();
      break;
    case 'moderation':
      loadModerationData();
      break;
    case 'analytics':
      loadAnalytics();
      break;
    case 'diagnostics':
      loadDiagnosticsData();
      break;
  }
}

// =====================================================
// DASHBOARD DATA
// =====================================================

async function loadDashboardData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      throw new Error('Supabase client not available');
    }
    
    console.log('Loading dashboard data...');
    
    // Load system diagnostics
    const { data: diagnostics, error: diagError } = await client
      .from('admin_system_diagnostics')
      .select('*');

    if (diagError) {
      console.error('Diagnostics error:', diagError);
      throw diagError;
    }

    console.log('Diagnostics loaded:', diagnostics);

    // Update stat cards
    if (diagnostics && diagnostics.length > 0) {
      diagnostics.forEach(metric => {
        // Convert metric name to element ID
        // e.g., "total_users" -> "statTotalUsers"
        const elementId = `stat${metric.metric.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join('')}`;
        
        console.log(`Setting ${elementId} = ${metric.value}`);
        
        const valueEl = $(`#${elementId}`);
        if (valueEl) {
          valueEl.textContent = metric.value;
        } else {
          console.warn(`Element #${elementId} not found`);
        }
      });
    } else {
      console.warn('No diagnostics data received');
    }

    // Load recent activity
    await loadRecentActivity();

  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    showToast('Failed to load dashboard data', 'error');
  }
}

async function loadRecentActivity() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data: activity, error } = await client.rpc('admin_get_activity_log', { 
      limit_count: 10 
    });

    if (error) throw error;

    const tableBody = $('#recentActivityTable');
    if (!tableBody) return;

    if (!activity || activity.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="table-loading">No recent activity</td></tr>';
      return;
    }

    tableBody.innerHTML = activity.map(item => `
      <tr>
        <td>
          <span class="badge badge-${item.activity_type === 'comment' ? 'success' : 'warning'}">
            ${item.activity_type}
          </span>
        </td>
        <td>${item.username || 'Unknown'}</td>
        <td>${JSON.stringify(item.details).slice(0, 60)}...</td>
        <td>${formatDate(item.created_at)}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Failed to load recent activity:', error);
  }
}

// =====================================================
// USERS MANAGEMENT
// =====================================================

async function loadUsersData(page = 1) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    adminState.usersPage = page;

    const { data: users, error, count } = await client
      .from('admin_users_overview')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * ADMIN_CONFIG.usersPerPage, page * ADMIN_CONFIG.usersPerPage - 1);

    if (error) throw error;

    adminState.usersTotal = count || 0;

    const tableBody = $('#usersTable');
    if (!tableBody) return;

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No users found</td></tr>';
      return;
    }

    tableBody.innerHTML = users.map(user => `
      <tr>
        <td>
          ${user.username || 'N/A'}
          ${user.is_admin ? '<span class="badge badge-admin">ADMIN</span>' : ''}
          ${!user.is_admin && user.is_moderator ? '<span class="badge">MODERATOR</span>' : ''}
        </td>
        <td>${user.email || 'N/A'}</td>
        <td>${user.level || 0}</td>
        <td>${user.xp || 0}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <span class="badge ${user.banned_until ? 'badge-danger' : 'badge-success'}">
            ${user.banned_until ? 'Banned' : 'Active'}
          </span>
        </td>
        <td>
          <button class="btn-secondary" onclick="viewUserDetails('${user.id}')">
            View
          </button>
        </td>
      </tr>
    `).join('');

    // Update pagination
    updateUsersPagination();

  } catch (error) {
    console.error('Failed to load users:', error);
    showToast('Failed to load users', 'error');
  }
}

function updateUsersPagination() {
  const totalPages = Math.ceil(adminState.usersTotal / ADMIN_CONFIG.usersPerPage);
  const currentPage = adminState.usersPage;

  const prevBtn = $('#btnUsersPrev');
  const nextBtn = $('#btnUsersNext');
  const infoEl = $('#usersPaginationInfo');

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (infoEl) infoEl.textContent = `Page ${currentPage} of ${totalPages}`;
}

async function viewUserDetails(userId) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Loading user details...', 'info');

    const { data, error } = await client.rpc('admin_get_user_details', { 
      target_user_id: userId 
    });

    if (error) throw error;

    // Show modal with user details
    const modal = $('#userDetailModal');
    const content = $('#userDetailContent');
    
    if (!modal || !content) return;
    
    const profile = data.profile || {};
    const stats = data.stats || {};
    const authData = data.auth_data || {};
    const isCurrentUserAdmin = Boolean(profile.is_admin);
    const isSelf = profile && profile.id === ADMIN_CONFIG.requiredUserId;
    const authEmail = authData.email || profile.email || '';
    const bannedUntil = authData.banned_until;
    const banLabel = bannedUntil
      ? `Banned until ${formatDate(bannedUntil)}`
      : 'Active';
    const statusBadgeClass = bannedUntil ? 'badge-danger' : 'badge-success';
    const formattedJoined = authData.created_at ? formatDate(authData.created_at) : 'Unknown';
    const formattedLastSignIn = authData.last_sign_in_at ? formatDate(authData.last_sign_in_at) : 'Never';
    const emailEscaped = escapeHtml(authEmail);
    const usernameEscaped = escapeHtml(profile.username || '');
    const nameEscaped = escapeHtml(profile.name || '');

    content.innerHTML = `
      <div class="user-detail-grid">
        <section class="user-detail-card user-detail-card--full">
          <div class="user-detail-header">
            <div>
              <h4 class="user-detail-title">${usernameEscaped || 'Unknown user'}</h4>
              <p class="user-detail-subtitle">${emailEscaped || 'No email provided'}</p>
            </div>
            <div class="user-detail-status">
              <span class="badge ${statusBadgeClass}">${banLabel}</span>
              ${isCurrentUserAdmin ? '<span class="badge badge-admin">Admin</span>' : ''}
              ${!isCurrentUserAdmin && profile.is_moderator ? '<span class="badge">Moderator</span>' : ''}
            </div>
          </div>
          <dl class="user-detail-meta">
            <div>
              <dt>User ID</dt>
              <dd>${escapeHtml(profile.id || 'N/A')}</dd>
            </div>
            <div>
              <dt>Display name</dt>
              <dd>${nameEscaped || '—'}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>${Number.isFinite(profile.level) ? profile.level : 0}</dd>
            </div>
            <div>
              <dt>Total XP</dt>
              <dd>${Number.isFinite(profile.xp) ? profile.xp : 0}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>${formattedJoined}</dd>
            </div>
            <div>
              <dt>Last sign in</dt>
              <dd>${formattedLastSignIn}</dd>
            </div>
          </dl>
        </section>

        <section class="user-detail-card">
          <h4 class="user-detail-section-title">Edit profile</h4>
          <form id="userProfileForm" class="user-detail-form" onsubmit="handleUserProfileSubmit(event, '${userId}')">
            <div class="user-detail-form-grid">
              <label class="admin-form-field">
                <span>Username</span>
                <input type="text" name="username" value="${usernameEscaped}" maxlength="32" />
              </label>
              <label class="admin-form-field">
                <span>Display name</span>
                <input type="text" name="name" value="${nameEscaped}" maxlength="64" />
              </label>
              <label class="admin-form-field">
                <span>XP</span>
                <input type="number" name="xp" min="0" step="1" value="${Number.isFinite(profile.xp) ? profile.xp : 0}" />
              </label>
              <label class="admin-form-field">
                <span>Level</span>
                <input type="number" name="level" min="0" step="1" value="${Number.isFinite(profile.level) ? profile.level : 0}" />
              </label>
              <label class="admin-form-field">
                <span>Role</span>
                <select name="role" ${isSelf ? 'disabled' : ''}>
                  <option value="user" ${!isCurrentUserAdmin && !profile.is_moderator ? 'selected' : ''}>User</option>
                  <option value="moderator" ${!isCurrentUserAdmin && profile.is_moderator ? 'selected' : ''}>Moderator</option>
                  <option value="admin" ${isCurrentUserAdmin ? 'selected' : ''}>Admin</option>
                </select>
              </label>
            </div>
            ${isSelf ? '<p class="user-detail-hint">You cannot remove admin access from your own account.</p>' : ''}
            <div class="user-detail-actions">
              <button type="submit" class="btn-primary">Save profile changes</button>
            </div>
          </form>
        </section>

        <section class="user-detail-card">
          <h4 class="user-detail-section-title">Account controls</h4>
          <form
            id="userAccountForm"
            class="user-detail-form"
            onsubmit="handleUserAccountSubmit(event, '${userId}')"
            data-original-email="${emailEscaped}"
            data-original-password-flag="${profile.require_password_change ? 'true' : 'false'}"
            data-original-email-flag="${profile.require_email_update ? 'true' : 'false'}"
          >
            <label class="admin-form-field">
              <span>Email address</span>
              <input type="email" name="email" value="${emailEscaped}" required />
            </label>
            <div class="user-detail-switches">
              <label class="admin-checkbox">
                <input type="checkbox" name="requirePasswordChange" ${profile.require_password_change ? 'checked' : ''} />
                <span>Require password change on next login</span>
              </label>
              <label class="admin-checkbox">
                <input type="checkbox" name="requireEmailUpdate" ${profile.require_email_update ? 'checked' : ''} />
                <span>Require user to verify or update email</span>
              </label>
            </div>
            <div class="user-detail-actions">
              <button type="submit" class="btn-secondary">Save account settings</button>
            </div>
          </form>
          <div class="user-detail-actions-group">
            <span class="user-detail-actions-label">Password & access</span>
            <div class="user-detail-inline-actions">
              <button class="btn-secondary" type="button" onclick="handleSendPasswordReset('${userId}')">Send reset link</button>
              <button class="btn-secondary" type="button" onclick="handleSendMagicLink('${userId}')">Send magic link</button>
              <input class="admin-inline-input" type="text" placeholder="Temporary password" oninput="this.dataset.pwd=this.value" />
              <button class="btn-secondary" type="button" onclick="handleSetTempPassword('${userId}', this.previousElementSibling.dataset.pwd||'')">Set temporary</button>
            </div>
          </div>
        </section>

        <section class="user-detail-card">
          <h4 class="user-detail-section-title">Moderation tools</h4>
          ${!isSelf ? `
          <div class="user-detail-actions-group">
            <span class="user-detail-actions-label">Quick XP adjustments</span>
            <div class="user-detail-inline-actions">
              <button class="btn-primary" type="button" onclick="handleUserXpAdjustment('${userId}', 100)">+100 XP</button>
              <button class="btn-primary" type="button" onclick="handleUserXpAdjustment('${userId}', 500)">+500 XP</button>
              <button class="btn-secondary" type="button" onclick="handleUserXpAdjustment('${userId}', -100)">-100 XP</button>
              <button class="btn-secondary" type="button" onclick="handleUserXpAdjustment('${userId}', -500)">-500 XP</button>
            </div>
          </div>
          <div class="user-detail-actions-group">
            <span class="user-detail-actions-label">Set XP / Level</span>
            <div class="user-detail-inline-actions">
              <input class="admin-inline-input" type="number" min="0" step="1" placeholder="XP" oninput="this.dataset.xp=this.value" />
              <input class="admin-inline-input" type="number" min="0" step="1" placeholder="Level" oninput="this.dataset.level=this.value" />
              <button class="btn-primary" type="button" onclick="handleSetXpLevel('${userId}', this.previousElementSibling.dataset.level||'', this.previousElementSibling.previousElementSibling.dataset.xp||'')">Save</button>
            </div>
          </div>
          <div class="user-detail-actions-group">
            <span class="user-detail-actions-label">Account status</span>
            <div class="user-detail-inline-actions">
              ${bannedUntil
                ? `<button type="button" class="btn-primary" onclick="handleUserBanToggle('${userId}', true)">Remove ban</button>`
                : `<button type="button" class="btn-secondary user-detail-danger" onclick="handleUserBanToggle('${userId}', false)">Ban user (30 days)</button>`}
            </div>
          </div>
          ` : '<p class="user-detail-hint">You cannot moderate your own account.</p>'}
        </section>

        <section class="user-detail-card">
          <h4 class="user-detail-section-title">Advanced moderation</h4>
          ${!isSelf ? `
          <form class="user-detail-form" onsubmit="handleUserBanForm(event, '${userId}')">
            <div class="user-detail-form-grid">
              <label class="admin-form-field">
                <span>Ban duration</span>
                <select name="duration">
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="permanent">Permanent</option>
                  <option value="custom">Custom date</option>
                </select>
              </label>
              <label class="admin-form-field">
                <span>Custom until</span>
                <input type="datetime-local" name="until" />
              </label>
              <label class="admin-form-field">
                <span>Reason</span>
                <input type="text" name="reason" maxlength="200" placeholder="Optional reason" />
              </label>
              <label class="admin-checkbox">
                <input type="checkbox" name="block_email" />
                <span>Also block this email</span>
              </label>
            </div>
            <div class="user-detail-inline-actions">
              ${bannedUntil
                ? '<button type="button" class="btn-primary" onclick="handleUserBanToggle(\'${userId}\', true)">Remove ban</button>'
                : '<button type="submit" class="btn-secondary user-detail-danger">Ban user</button>'}
            </div>
          </form>
          ` : '<p class="user-detail-hint">Self-ban is disabled.</p>'}
        </section>

        <section class="user-detail-card user-detail-card--full">
          <h4 class="user-detail-section-title">Activity statistics</h4>
          <div class="user-detail-stats-grid">
            <div>
              <p class="user-detail-stat-label">Comments</p>
              <p class="user-detail-stat-value">${stats.comments || 0}</p>
            </div>
            <div>
              <p class="user-detail-stat-label">Ratings</p>
              <p class="user-detail-stat-value">${stats.ratings || 0}</p>
            </div>
            <div>
              <p class="user-detail-stat-label">Visits</p>
              <p class="user-detail-stat-value">${stats.visits || 0}</p>
            </div>
            <div>
              <p class="user-detail-stat-label">Completed tasks</p>
              <p class="user-detail-stat-value">${stats.completed_tasks || 0}</p>
            </div>
            <div>
              <p class="user-detail-stat-label">Total XP earned</p>
              <p class="user-detail-stat-value">${stats.total_xp || profile.xp || 0}</p>
            </div>
          </div>
        </section>
      </div>
    `;

    const accountForm = content.querySelector('#userAccountForm');
    if (accountForm) {
      accountForm.dataset.originalEmail = authEmail;
      accountForm.dataset.originalPasswordFlag = profile.require_password_change ? 'true' : 'false';
      accountForm.dataset.originalEmailFlag = profile.require_email_update ? 'true' : 'false';
    }

    showElement(modal);

  } catch (error) {
    console.error('Failed to load user details:', error);
    showToast('Failed to load user details', 'error');
  }
}

async function handleUserProfileSubmit(event, userId) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const client = ensureSupabase();

  if (!client) {
    showToast('Database connection not available', 'error');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');

  const username = (formData.get('username') || '').toString().trim();
  const displayName = (formData.get('name') || '').toString().trim();
  const xpRaw = (formData.get('xp') || '').toString().trim();
  const levelRaw = (formData.get('level') || '').toString().trim();
  const role = (formData.get('role') || '').toString();
  const isAdmin = role === 'admin';
  const isModerator = role === 'moderator';

  const xpValue = xpRaw === '' ? null : Number.parseInt(xpRaw, 10);
  const levelValue = levelRaw === '' ? null : Number.parseInt(levelRaw, 10);

  if (xpValue !== null && Number.isNaN(xpValue)) {
    showToast('Invalid XP value provided', 'error');
    return;
  }

  if (levelValue !== null && Number.isNaN(levelValue)) {
    showToast('Invalid level value provided', 'error');
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    showToast('Saving profile changes...', 'info');

    const { error } = await client.rpc('admin_update_user_profile', {
      target_user_id: userId,
      new_username: username || null,
      new_name: displayName || null,
      new_xp: xpValue,
      new_level: levelValue,
      new_is_admin: isAdmin,
      new_is_moderator: isModerator,
    });

    if (error) {
      throw error;
    }

    showToast('Profile updated successfully', 'success');

    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    await viewUserDetails(userId);

  } catch (error) {
    console.error('Failed to update profile:', error);
    showToast('Failed to update profile: ' + (error.message || 'Unknown error'), 'error');

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function handleUserAccountSubmit(event, userId) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const client = ensureSupabase();

  if (!client) {
    showToast('Database connection not available', 'error');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');

  const email = (formData.get('email') || '').toString().trim();
  const requirePasswordChange = formData.get('requirePasswordChange') === 'on';
  const requireEmailUpdate = formData.get('requireEmailUpdate') === 'on';

  const originalEmail = (form.dataset.originalEmail || '').trim();
  const originalPasswordFlag = form.dataset.originalPasswordFlag === 'true';
  const originalEmailFlag = form.dataset.originalEmailFlag === 'true';

  const payload = {};
  if (email !== originalEmail) payload.email = email;
  if (requirePasswordChange !== originalPasswordFlag) payload.require_password_change = requirePasswordChange;
  if (requireEmailUpdate !== originalEmailFlag) payload.require_email_update = requireEmailUpdate;

  if (Object.keys(payload).length === 0) {
    showToast('No account changes detected', 'info');
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    showToast('Applying account updates...', 'info');
    await apiRequest(`/users/${userId}/account`, { method: 'POST', body: JSON.stringify(payload) });

    showToast('Account settings updated', 'success');

    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    await viewUserDetails(userId);

  } catch (error) {
    console.error('Failed to update account settings:', error);
    showToast('Failed to update account settings: ' + (error.message || 'Unknown error'), 'error');

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function handleUserXpAdjustment(userId, change) {
  const success = await adjustUserXP(userId, change);
  if (success) {
    await viewUserDetails(userId);
  }
}

async function handleUserBanToggle(userId, isCurrentlyBanned) {
  let success = false;
  if (isCurrentlyBanned) {
    success = await unbanUser(userId);
  } else {
    success = await banUser(userId);
  }

  if (success) {
    await viewUserDetails(userId);
  }
}

// Make function global for onclick
window.viewUserDetails = viewUserDetails;
window.handleUserProfileSubmit = handleUserProfileSubmit;
window.handleUserAccountSubmit = handleUserAccountSubmit;
window.handleUserXpAdjustment = handleUserXpAdjustment;
window.handleUserBanToggle = handleUserBanToggle;
window.handleUserBanForm = handleUserBanForm;
window.handleSendPasswordReset = handleSendPasswordReset;
window.handleSendMagicLink = handleSendMagicLink;
window.handleSetTempPassword = handleSetTempPassword;
window.handleSetXpLevel = handleSetXpLevel;

async function handleSendPasswordReset(userId) {
  try {
    await apiRequest(`/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ action: 'reset' }) });
    showToast('Password reset link generated', 'success');
  } catch (e) {
    showToast('Failed to generate reset link: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function handleSendMagicLink(userId) {
  try {
    await apiRequest(`/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ action: 'magic_link' }) });
    showToast('Magic link generated', 'success');
  } catch (e) {
    showToast('Failed to generate magic link: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function handleSetTempPassword(userId, tempPwd) {
  const pwd = (tempPwd || '').trim();
  if (pwd.length < 8) {
    showToast('Temporary password must be at least 8 characters', 'error');
    return;
  }
  try {
    await apiRequest(`/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ action: 'set_temporary', temp_password: pwd }) });
    showToast('Temporary password set', 'success');
  } catch (e) {
    showToast('Failed to set temporary password: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function handleSetXpLevel(userId, levelStr, xpStr) {
  const xp = xpStr === '' ? null : Number.parseInt(xpStr, 10);
  const level = levelStr === '' ? null : Number.parseInt(levelStr, 10);
  if ((xp !== null && Number.isNaN(xp)) || (level !== null && Number.isNaN(level))) {
    showToast('Invalid XP/Level', 'error');
    return;
  }
  const ok = await setUserXpLevel(userId, xp, level);
  if (ok) await viewUserDetails(userId);
}

async function getAdminAccessToken() {
  const client = ensureSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data && data.session ? data.session.access_token : null;
}

async function apiRequest(path, options = {}) {
  const token = await getAdminAccessToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/admin/api${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const body = await res.json();
      msg = body.message || body.error || msg;
    } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return null;
}

async function setUserXpLevel(userId, xp, level) {
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    const { error } = await client.rpc('admin_set_user_xp_level', { target_user_id: userId, xp, level });
    if (error) throw error;
    showToast('XP/Level set', 'success');
    return true;
  } catch (e) {
    console.error(e);
    showToast('Failed to set XP/Level: ' + (e.message || 'Unknown error'), 'error');
    return false;
  }
}

async function handleUserBanForm(event, userId) {
  event.preventDefault();
  const form = event.target;
  const duration = (form.duration.value || '').trim();
  const reason = (form.reason.value || '').trim() || 'Violating terms';
  
  let days = 30;
  if (duration === '7d') days = 7;
  else if (duration === '30d') days = 30;
  else if (duration === '90d') days = 90;
  else if (duration === 'perm') days = 36500; // 100 years ~= permanent
  
  try {
    // Call new version of banUser (without confirm since form already has submit)
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    
    const { error } = await client.rpc('admin_ban_user', {
      target_user_id: userId,
      ban_reason: reason,
      ban_duration: `${days} days`
    });
    
    if (error) throw error;
    
    showToast('User banned successfully', 'success');
    await viewUserDetails(userId);
  } catch (e) {
    console.error(e);
    showToast('Failed to ban user: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function loadQuestsData() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    const view = $('#viewQuests');
    if (!view) return;
    const { data, error } = await client
      .from('tasks')
      .select('id,xp,is_active,sort_order,category,title,description')
      .eq('category', 'quest')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    adminState.quests = Array.isArray(data) ? data : [];
    const tbody = $('#questsTableBody');
    if (!tbody) return;
    if (adminState.quests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-loading">No quests</td></tr>';
      return;
    }
    tbody.innerHTML = adminState.quests.map(q => `
      <tr>
        <td>${escapeHtml(q.id)}</td>
        <td>${Number(q.xp)||0}</td>
        <td>${q.is_active ? 'Yes' : 'No'}</td>
        <td>${Number(q.sort_order)||0}</td>
        <td>
          <button class="btn-secondary" onclick="handleQuestEdit('${q.id}')">Edit</button>
          <button class="btn-secondary user-detail-danger" onclick="handleQuestDelete('${q.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    showToast('Failed to load quests', 'error');
  }
}

function openQuestForm(mode, quest) {
  adminState.questFormMode = mode;
  adminState.selectedQuest = quest || null;
  const modal = $('#questFormModal');
  const title = $('#questFormTitle');
  const idInput = $('#questId');
  const titleInput = $('#questTitle');
  const xpInput = $('#questXp');
  const sortInput = $('#questSort');
  const activeSelect = $('#questActive');
  const descInput = $('#questDescription');
  if (!modal || !title || !idInput || !xpInput || !sortInput || !activeSelect) return;
  if (mode === 'edit' && quest) {
    title.textContent = 'Edit Quest';
    idInput.value = quest.id;
    idInput.disabled = true;
    if (titleInput) titleInput.value = quest.title || '';
    xpInput.value = Number(quest.xp)||0;
    sortInput.value = Number(quest.sort_order)||1000;
    activeSelect.value = quest.is_active ? 'true' : 'false';
    if (descInput) descInput.value = quest.description || '';
  } else {
    title.textContent = 'New Quest';
    idInput.value = '';
    idInput.disabled = false;
    if (titleInput) titleInput.value = '';
    xpInput.value = 0;
    sortInput.value = 1000;
    activeSelect.value = 'true';
    if (descInput) descInput.value = '';
  }
  showElement(modal);
}

async function handleQuestDelete(id) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    const { error } = await client.from('tasks').delete().eq('id', id);
    if (error) throw error;
    showToast('Quest deleted', 'success');
    await loadQuestsData();
  } catch (e) {
    showToast('Failed to delete quest', 'error');
  }
}

function handleQuestEdit(id) {
  const q = adminState.quests.find(x => x.id === id);
  openQuestForm('edit', q || null);
}

async function handleQuestFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const client = ensureSupabase();
  if (!client) return;
  const id = ($('#questId').value || '').trim();
  const qtitle = ($('#questTitle').value || '').trim();
  const xp = Number($('#questXp').value || '0') || 0;
  const sort_order = Number($('#questSort').value || '1000') || 1000;
  const is_active = $('#questActive').value === 'true';
  const description = ($('#questDescription').value || '').trim();
  const payload = { id, xp, sort_order, is_active, category: 'quest', title: qtitle || null, description: description || null };
  try {
    const { error } = await client.from('tasks').upsert(payload);
    if (error) throw error;
    showToast('Quest saved', 'success');
    hideElement($('#questFormModal'));
    await loadQuestsData();
  } catch (e) {
    showToast('Failed to save quest', 'error');
  }
}

window.handleQuestDelete = handleQuestDelete;
window.handleQuestEdit = handleQuestEdit;

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = $('#btnAddQuest');
  if (addBtn) addBtn.addEventListener('click', () => openQuestForm('create'));
  const refreshBtn = $('#btnRefreshQuests');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadQuestsData());
  const closeBtn = $('#btnCloseQuestForm');
  if (closeBtn) closeBtn.addEventListener('click', () => hideElement($('#questFormModal')));
  const cancelBtn = $('#questFormCancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => hideElement($('#questFormModal')));
  const form = $('#questForm');
  if (form) form.addEventListener('submit', handleQuestFormSubmit);
});

// =====================================================
// CARS MANAGEMENT
// =====================================================

async function loadCarsData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log('Loading car bookings data...');

    // Load car bookings - NO RPC, NO JOIN, just simple select
    const { data: bookings, error } = await client
      .from('car_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading car bookings:', error);
      throw error;
    }

    console.log('Car bookings loaded:', bookings);
    console.log('Total bookings count:', bookings?.length || 0);

    // Calculate stats manually from bookings data
    let totalBookings, activeRentals, pendingBookings, totalRevenue;
    
    if (bookings && bookings.length > 0) {
      // Count by status
      totalBookings = bookings.length;
      activeRentals = bookings.filter(b => b.status === 'active').length;
      pendingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'message_sent').length;
      
      // Sum revenue from confirmed/completed bookings with final_price
      totalRevenue = bookings
        .filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.final_price)
        .reduce((sum, b) => sum + parseFloat(b.final_price), 0);
    } else {
      // No bookings yet
      totalBookings = 0;
      activeRentals = 0;
      pendingBookings = 0;
      totalRevenue = 0;
    }

    // Update stats cards
    const statTotalBookings = $('#statTotalBookings');
    const statActiveRentals = $('#statActiveRentals');
    const statPendingBookings = $('#statPendingBookings');
    const statTotalRevenue = $('#statTotalRevenue');

    if (statTotalBookings) {
      statTotalBookings.textContent = totalBookings;
      const changeEl = statTotalBookings.parentElement.querySelector('.stat-card-change');
      if (changeEl) changeEl.textContent = `${bookings?.length || 0} in database`;
    }
    
    if (statActiveRentals) {
      statActiveRentals.textContent = activeRentals;
      const changeEl = statActiveRentals.parentElement.querySelector('.stat-card-change');
      if (changeEl) changeEl.textContent = 'Currently active';
    }
    
    if (statPendingBookings) {
      statPendingBookings.textContent = pendingBookings;
      const changeEl = statPendingBookings.parentElement.querySelector('.stat-card-change');
      if (changeEl) changeEl.textContent = 'Awaiting confirmation';
    }
    
    if (statTotalRevenue) {
      statTotalRevenue.textContent = `€${totalRevenue.toFixed(2)}`;
      const changeEl = statTotalRevenue.parentElement.querySelector('.stat-card-change');
      if (changeEl) changeEl.textContent = 'Paid bookings only';
    }

    // Update table
    const tableBody = $('#carsTableBody');
    if (!tableBody) return;

    if (!bookings || bookings.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="table-loading">
            No car bookings yet. System is ready to accept bookings!
            <br><small style="margin-top: 8px; display: block;">Car offers are available in Paphos and Larnaca.</small>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = bookings.map(booking => {
      const startDate = booking.pickup_date ? new Date(booking.pickup_date).toLocaleDateString('en-GB') : 'N/A';
      const endDate = booking.return_date ? new Date(booking.return_date).toLocaleDateString('en-GB') : 'N/A';
      
      // Calculate rental days (combine date + time for accurate calculation)
      let rentalDays = 0;
      if (booking.pickup_date && booking.return_date) {
        const pickupDateTime = new Date(booking.pickup_date + 'T' + (booking.pickup_time || '10:00:00'));
        const returnDateTime = new Date(booking.return_date + 'T' + (booking.return_time || '10:00:00'));
        const hours = (returnDateTime - pickupDateTime) / (1000 * 60 * 60);
        rentalDays = Math.ceil(hours / 24);
      } else {
        rentalDays = booking.days_count || 0;
      }
      
      // Status badge colors
      const statusClass = 
        booking.status === 'confirmed' ? 'badge-success' :
        booking.status === 'active' ? 'badge-info' :
        booking.status === 'completed' ? 'badge-success' :
        booking.status === 'pending' ? 'badge-warning' :
        booking.status === 'cancelled' ? 'badge-danger' : 'badge';
      
      // Location badges
      const pickupLoc = booking.pickup_location ? booking.pickup_location.toUpperCase().replace('_', ' ') : '?';
      const returnLoc = booking.return_location ? booking.return_location.toUpperCase().replace('_', ' ') : '?';
      
      return `
        <tr>
          <td>
            <div style="font-weight: 600;">#${booking.id.slice(0, 8).toUpperCase()}</div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${pickupLoc} → ${returnLoc}
            </div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(booking.full_name || booking.customer_name || 'N/A')}</div>
            <div style="font-size: 12px; color: var(--admin-text-muted);">${escapeHtml(booking.email || booking.customer_email || '')}</div>
            ${(booking.phone || booking.customer_phone) ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(booking.phone || booking.customer_phone)}</div>` : ''}
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(booking.car_model || booking.car_type || 'N/A')}</div>
            ${booking.location ? `<div style="font-size: 12px; color: var(--admin-text-muted);">${escapeHtml(booking.location.toUpperCase())}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 13px; white-space: nowrap;">
              📅 ${startDate}<br>
              ⬇️ ${endDate}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: var(--admin-primary); margin-top: 4px;">
              🕒 ${rentalDays} day${rentalDays !== 1 ? 's' : ''}
            </div>
          </td>
          <td>
            <span class="badge ${statusClass}" style="display: block; margin-bottom: 4px;">
              ${(booking.status || 'unknown').toUpperCase()}
            </span>
            <span class="badge badge-info" style="font-size: 10px;">
              ${(booking.payment_status || 'unpaid').toUpperCase()}
            </span>
          </td>
          <td style="font-weight: 600; color: var(--admin-success);">
            €${Number(booking.final_price || booking.quoted_price || booking.total_price || 0).toFixed(2)}
            ${booking.currency && booking.currency !== 'EUR' ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${booking.currency}</div>` : ''}
            ${!booking.final_price && !booking.quoted_price ? `<div style="font-size: 10px; color: var(--admin-warning);">Not quoted yet</div>` : ''}
          </td>
          <td>
            <button class="btn-secondary" onclick="viewCarBookingDetails('${booking.id}')" title="View details">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');

    showToast('Car bookings loaded successfully', 'success');

  } catch (error) {
    console.error('Failed to load car bookings:', error);
    showToast('Failed to load car bookings: ' + (error.message || 'Unknown error'), 'error');
    
    const tableBody = $('#carsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="table-loading" style="color: var(--admin-danger);">
            ❌ Error loading data: ${escapeHtml(error.message || 'Unknown error')}
            <br><small style="margin-top: 8px; display: block;">
              Make sure the car_bookings table exists in Supabase. 
              Run the migration: supabase/migrations/001_car_rentals_system.sql
            </small>
          </td>
        </tr>
      `;
    }
  }
}

async function viewCarBookingDetails(bookingId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    console.log('Loading booking details:', bookingId);

    // Fetch booking details
    const { data: booking, error } = await client
      .from('car_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error loading booking:', error);
      showToast('Failed to load booking details', 'error');
      return;
    }

    if (!booking) {
      showToast('Booking not found', 'error');
      return;
    }

    // Show modal
    const modal = $('#bookingDetailsModal');
    const content = $('#bookingDetailsContent');
    if (!modal || !content) return;

    // Format dates
    const pickupDate = booking.pickup_date ? new Date(booking.pickup_date).toLocaleDateString('en-GB') : 'N/A';
    const returnDate = booking.return_date ? new Date(booking.return_date).toLocaleDateString('en-GB') : 'N/A';
    const createdAt = booking.created_at ? new Date(booking.created_at).toLocaleString('en-GB') : 'N/A';
    
    // Calculate rental days (combine date + time for accurate calculation)
    let days = 0;
    if (booking.pickup_date && booking.return_date) {
      const pickupDateTime = new Date(booking.pickup_date + 'T' + (booking.pickup_time || '10:00:00'));
      const returnDateTime = new Date(booking.return_date + 'T' + (booking.return_time || '10:00:00'));
      const hours = (returnDateTime - pickupDateTime) / (1000 * 60 * 60);
      days = Math.ceil(hours / 24);
    }

    // Fetch car pricing from car_offers table
    let carPricing = null;
    let calculatedBasePrice = 0;
    let priceBreakdown = '';
    
    try {
      const { data: carOffer } = await client
        .from('car_offers')
        .select('*')
        .eq('car_model', booking.car_model)
        .eq('location', (booking.location || 'larnaca').toLowerCase())
        .single();
      
      carPricing = carOffer;
      
      // Calculate base price according to pricing tiers
      if (carPricing) {
        const location = (booking.location || 'larnaca').toLowerCase();
        
        if (location === 'paphos') {
          // Paphos tiered pricing
          if (days <= 3) {
            calculatedBasePrice = carPricing.price_3days || 0;
            priceBreakdown = `${days} days × Package rate = €${calculatedBasePrice.toFixed(2)}`;
          } else if (days <= 6) {
            const dailyRate = carPricing.price_4_6days || 0;
            calculatedBasePrice = dailyRate * days;
            priceBreakdown = `${days} days × €${dailyRate}/day = €${calculatedBasePrice.toFixed(2)}`;
          } else if (days <= 10) {
            const dailyRate = carPricing.price_7_10days || 0;
            calculatedBasePrice = dailyRate * days;
            priceBreakdown = `${days} days × €${dailyRate}/day = €${calculatedBasePrice.toFixed(2)}`;
          } else {
            const dailyRate = carPricing.price_10plus_days || 0;
            calculatedBasePrice = dailyRate * days;
            priceBreakdown = `${days} days × €${dailyRate}/day = €${calculatedBasePrice.toFixed(2)}`;
          }
        } else {
          // Larnaca simple per-day pricing
          const dailyRate = carPricing.price_per_day || carPricing.price_10plus_days || 0;
          calculatedBasePrice = dailyRate * days;
          priceBreakdown = `${days} days × €${dailyRate}/day = €${calculatedBasePrice.toFixed(2)}`;
        }
      }
    } catch (err) {
      console.warn('Could not fetch car pricing:', err);
    }

    // Calculate extras
    const numPassengers = booking.num_passengers || 1;
    const passengerSurcharge = numPassengers > 2 ? (numPassengers - 2) * 5 : 0; // €5 per extra passenger
    const childSeatsSurcharge = 0; // Child seats are FREE
    const insuranceCost = booking.full_insurance ? (days * 17) : 0; // €17/day for full insurance
    
    const totalExtras = passengerSurcharge + childSeatsSurcharge + insuranceCost;
    const suggestedTotal = calculatedBasePrice + totalExtras;

    // Status badge
    const statusClass = 
      booking.status === 'confirmed' ? 'badge-success' :
      booking.status === 'pending' ? 'badge-warning' :
      booking.status === 'cancelled' ? 'badge-danger' : 'badge';

    // Build content HTML
    content.innerHTML = `
      <div style="display: grid; gap: 24px;">
        <!-- Header Info -->
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 600;">Booking #${booking.id.slice(0, 8).toUpperCase()}</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: var(--admin-text-muted);">Created: ${createdAt}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <select id="bookingStatusDropdown" class="admin-form-field" style="padding: 8px 12px; font-size: 14px; font-weight: 600;" onchange="updateBookingStatus('${booking.id}', this.value)">
                <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="message_sent" ${booking.status === 'message_sent' ? 'selected' : ''}>📧 Wiadomość wysłana</option>
                <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>✅ Potwierdzone</option>
                <option value="active" ${booking.status === 'active' ? 'selected' : ''}>🚗 Active</option>
                <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>✔️ Completed</option>
                <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
              </select>
              <span class="badge ${statusClass}" style="font-size: 14px; padding: 6px 12px;">${(booking.status || 'pending').toUpperCase()}</span>
            </div>
          </div>
        </div>

        <!-- Customer Information -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Customer Information</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Name:</span>
              <span>${escapeHtml(booking.full_name || 'N/A')}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Email:</span>
              <span><a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email || 'N/A')}</a></span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Phone:</span>
              <span><a href="tel:${escapeHtml(booking.phone)}">${escapeHtml(booking.phone || 'N/A')}</a></span>
            </div>
            ${booking.country ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Country:</span>
              <span>${escapeHtml(booking.country)}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Rental Details -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Rental Details</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Car Model:</span>
              <span style="font-weight: 600;">${escapeHtml(booking.car_model || 'N/A')}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Location:</span>
              <span>${escapeHtml((booking.location || 'N/A').toUpperCase())}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Pickup:</span>
              <span>📅 ${pickupDate} at ${booking.pickup_time || '10:00'} • 📍 ${escapeHtml((booking.pickup_location || 'N/A').replace('_', ' ').toUpperCase())}</span>
            </div>
            ${booking.pickup_address ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Pickup Address:</span>
              <span>${escapeHtml(booking.pickup_address)}</span>
            </div>
            ` : ''}
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Return:</span>
              <span>📅 ${returnDate} at ${booking.return_time || '10:00'} • 📍 ${escapeHtml((booking.return_location || 'N/A').replace('_', ' ').toUpperCase())}</span>
            </div>
            ${booking.return_address ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Return Address:</span>
              <span>${escapeHtml(booking.return_address)}</span>
            </div>
            ` : ''}
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Duration:</span>
              <span style="font-weight: 600; color: var(--admin-primary);">${days} day${days !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <!-- Additional Options -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Additional Options</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Passengers:</span>
              <span>${booking.num_passengers || 1}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Child Seats:</span>
              <span>${booking.child_seats || 0} ${booking.child_seats > 0 ? '(FREE)' : ''}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Full Insurance:</span>
              <span>${booking.full_insurance ? '✅ Yes (+17€/day)' : '❌ No'}</span>
            </div>
            ${booking.flight_number ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Flight Number:</span>
              <span>${escapeHtml(booking.flight_number)}</span>
            </div>
            ` : ''}
            ${booking.special_requests ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Special Requests:</span>
              <span>${escapeHtml(booking.special_requests)}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Automatic Price Calculation -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 20px; border-radius: 12px; color: white;">
          <h4 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">🧮</span>
            Automatic Price Calculation (${(booking.location || 'Larnaca').toUpperCase()} Rate)
          </h4>
          
          ${carPricing ? `
          <div style="background: rgba(255, 255, 255, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <div style="display: grid; gap: 10px;">
              <!-- Base Price -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
                <div>
                  <div style="font-weight: 600; font-size: 14px;">Base Rental Price</div>
                  <div style="font-size: 12px; opacity: 0.85; margin-top: 2px;">${priceBreakdown}</div>
                </div>
                <div style="font-size: 18px; font-weight: 700;">€${calculatedBasePrice.toFixed(2)}</div>
              </div>

              <!-- Extras -->
              ${passengerSurcharge > 0 || insuranceCost > 0 || booking.child_seats > 0 ? `
              <div style="padding-top: 8px;">
                <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; opacity: 0.9;">Extras:</div>
                ${passengerSurcharge > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>• Extra Passengers (${numPassengers - 2})</span>
                  <span>+€${passengerSurcharge.toFixed(2)}</span>
                </div>
                ` : ''}
                ${booking.child_seats > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>• Child Seats (${booking.child_seats})</span>
                  <span style="color: #86efac;">FREE</span>
                </div>
                ` : ''}
                ${insuranceCost > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>• Full Insurance (${days} days × €17)</span>
                  <span>+€${insuranceCost.toFixed(2)}</span>
                </div>
                ` : ''}
              </div>
              ` : ''}

              <!-- Total -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 2px solid rgba(255, 255, 255, 0.3); margin-top: 8px;">
                <div style="font-weight: 700; font-size: 16px;">SUGGESTED TOTAL</div>
                <div style="font-size: 24px; font-weight: 700; color: #fbbf24;">€${suggestedTotal.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          <div style="background: rgba(255, 255, 255, 0.15); padding: 12px; border-radius: 6px; font-size: 12px; line-height: 1.5;">
            <strong>ℹ️ Note:</strong> This is an automatic calculation based on the ${(booking.location || 'Larnaca').toUpperCase()} rate card. 
            You can adjust the quoted and final prices below if needed.
          </div>
          ` : `
          <div style="background: rgba(255, 255, 255, 0.1); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9;">⚠️ Car pricing not found in database for this model and location.</div>
            <div style="font-size: 12px; opacity: 0.75; margin-top: 8px;">Please manually set the quoted price below.</div>
          </div>
          `}
        </div>

        <!-- Manual Pricing Override -->
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600;">Manual Pricing Override</h4>
          <div style="display: grid; gap: 12px;">
            <!-- Quote Price Input -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label style="font-size: 12px; font-weight: 500; color: var(--admin-text-muted);">Quoted Price (€)</label>
                ${suggestedTotal > 0 ? `
                <button 
                  type="button" 
                  id="btnUseSuggestedPrice"
                  style="font-size: 11px; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;"
                  title="Use automatic calculated price"
                >
                  📋 Use €${suggestedTotal.toFixed(2)}
                </button>
                ` : ''}
              </div>
              <input 
                type="number" 
                id="bookingQuotedPrice" 
                value="${booking.quoted_price || ''}" 
                placeholder="0.00" 
                step="0.01"
                min="0"
                style="width: 100%; padding: 8px 12px; border: 1px solid var(--admin-border); border-radius: 4px; font-size: 14px;"
              />
              <small style="display: block; margin-top: 4px; font-size: 11px; color: var(--admin-text-muted);">Initial price quote for the customer</small>
            </div>

            <!-- Final Price Input -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: var(--admin-text-muted);">Final Price (€)</label>
              <input 
                type="number" 
                id="bookingFinalPrice" 
                value="${booking.final_price || ''}" 
                placeholder="0.00" 
                step="0.01"
                min="0"
                style="width: 100%; padding: 8px 12px; border: 1px solid var(--admin-border); border-radius: 4px; font-size: 14px; font-weight: 600;"
              />
              <small style="display: block; margin-top: 4px; font-size: 11px; color: var(--admin-text-muted);">Final agreed price (after any adjustments)</small>
            </div>

            <!-- Admin Notes -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: var(--admin-text-muted);">Admin Notes</label>
              <textarea 
                id="bookingAdminNotes" 
                rows="3"
                placeholder="Add notes about pricing, special conditions, etc."
                style="width: 100%; padding: 8px 12px; border: 1px solid var(--admin-border); border-radius: 4px; font-size: 13px; resize: vertical; font-family: inherit;"
              >${escapeHtml(booking.admin_notes || '')}</textarea>
            </div>

            <!-- Save Pricing Button -->
            <button 
              type="button" 
              id="btnSavePricing" 
              class="btn-primary"
              style="width: 100%; padding: 10px; font-size: 14px; font-weight: 600;"
            >
              💾 Save Pricing & Notes
            </button>
          </div>
        </div>
      </div>
    `;

    // Store current booking ID for actions
    modal.dataset.bookingId = bookingId;

    // Show modal
    modal.hidden = false;

    // Attach "Use Suggested Price" button event listener
    const btnUseSuggestedPrice = $('#btnUseSuggestedPrice');
    if (btnUseSuggestedPrice && suggestedTotal > 0) {
      btnUseSuggestedPrice.addEventListener('click', () => {
        const quotedPriceInput = $('#bookingQuotedPrice');
        if (quotedPriceInput) {
          quotedPriceInput.value = suggestedTotal.toFixed(2);
          quotedPriceInput.focus();
          showToast('Suggested price applied!', 'success');
        }
      });
    }

    // Attach Save Pricing event listener
    const btnSavePricing = $('#btnSavePricing');
    if (btnSavePricing) {
      btnSavePricing.addEventListener('click', async () => {
        const quotedPrice = parseFloat($('#bookingQuotedPrice')?.value) || null;
        const finalPrice = parseFloat($('#bookingFinalPrice')?.value) || null;
        const adminNotes = $('#bookingAdminNotes')?.value || null;

        try {
          btnSavePricing.disabled = true;
          btnSavePricing.textContent = 'Saving...';

          const client = ensureSupabase();
          if (!client) throw new Error('Database connection not available');

          const { error } = await client
            .from('car_bookings')
            .update({ 
              quoted_price: quotedPrice,
              final_price: finalPrice,
              admin_notes: adminNotes,
              updated_at: new Date().toISOString()
            })
            .eq('id', bookingId);

          if (error) throw error;

          showToast('Pricing and notes saved successfully!', 'success');
          await loadCarsData(); // Refresh table

        } catch (e) {
          console.error('Failed to save pricing:', e);
          showToast('Failed to save pricing: ' + e.message, 'error');
        } finally {
          btnSavePricing.disabled = false;
          btnSavePricing.textContent = '💾 Save Pricing & Notes';
        }
      });
    }

  } catch (e) {
    console.error('Failed to load booking details:', e);
    showToast('Failed to load booking details', 'error');
  }
}

// Open edit booking modal
async function openEditBooking(bookingId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    // Fetch booking details
    const { data: booking, error } = await client
      .from('car_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error loading booking:', error);
      showToast('Failed to load booking', 'error');
      return;
    }

    if (!booking) {
      showToast('Booking not found', 'error');
      return;
    }

    // Populate form
    $('#editBookingId').value = booking.id;
    $('#editFullName').value = booking.full_name || '';
    $('#editEmail').value = booking.email || '';
    $('#editPhone').value = booking.phone || '';
    $('#editCountry').value = booking.country || '';
    
    $('#editCarModel').value = booking.car_model || '';
    $('#editLocation').value = booking.location || 'paphos';
    
    $('#editPickupDate').value = booking.pickup_date || '';
    $('#editPickupTime').value = booking.pickup_time || '10:00';
    $('#editPickupLocation').value = booking.pickup_location || 'airport_pfo';
    $('#editPickupAddress').value = booking.pickup_address || '';
    
    $('#editReturnDate').value = booking.return_date || '';
    $('#editReturnTime').value = booking.return_time || '10:00';
    $('#editReturnLocation').value = booking.return_location || 'airport_pfo';
    $('#editReturnAddress').value = booking.return_address || '';
    
    $('#editNumPassengers').value = booking.num_passengers || 2;
    $('#editChildSeats').value = booking.child_seats || 0;
    $('#editFullInsurance').checked = booking.full_insurance || false;
    $('#editFlightNumber').value = booking.flight_number || '';
    $('#editSpecialRequests').value = booking.special_requests || '';
    
    $('#editStatus').value = booking.status || 'pending';

    // Hide details modal, show edit modal
    const detailsModal = $('#bookingDetailsModal');
    if (detailsModal) detailsModal.hidden = true;

    const editModal = $('#editBookingModal');
    if (editModal) editModal.hidden = false;

  } catch (e) {
    console.error('Failed to open edit booking:', e);
    showToast('Failed to open edit form', 'error');
  }
}

// Handle edit booking form submission
async function handleEditBookingSubmit(event) {
  event.preventDefault();

  const submitBtn = $('#editBookingSubmit');
  const errorEl = $('#editBookingError');

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    if (errorEl) errorEl.hidden = true;

    const bookingId = $('#editBookingId').value;
    if (!bookingId) throw new Error('Booking ID is missing');

    const updateData = {
      full_name: $('#editFullName').value,
      email: $('#editEmail').value,
      phone: $('#editPhone').value,
      country: $('#editCountry').value || null,
      
      car_model: $('#editCarModel').value,
      location: $('#editLocation').value,
      
      pickup_date: $('#editPickupDate').value,
      pickup_time: $('#editPickupTime').value,
      pickup_location: $('#editPickupLocation').value,
      pickup_address: $('#editPickupAddress').value || null,
      
      return_date: $('#editReturnDate').value,
      return_time: $('#editReturnTime').value,
      return_location: $('#editReturnLocation').value,
      return_address: $('#editReturnAddress').value || null,
      
      num_passengers: parseInt($('#editNumPassengers').value) || 1,
      child_seats: parseInt($('#editChildSeats').value) || 0,
      full_insurance: $('#editFullInsurance').checked,
      flight_number: $('#editFlightNumber').value || null,
      special_requests: $('#editSpecialRequests').value || null,
      
      status: $('#editStatus').value,
      updated_at: new Date().toISOString()
    };

    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    const { error } = await client
      .from('car_bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;

    showToast('Booking updated successfully!', 'success');

    // Close edit modal
    const editModal = $('#editBookingModal');
    if (editModal) editModal.hidden = true;

    // Reload table
    await loadCarsData();

    // Reopen details modal
    await viewCarBookingDetails(bookingId);

  } catch (e) {
    console.error('Failed to update booking:', e);
    
    if (errorEl) {
      errorEl.textContent = e.message || 'Failed to update booking';
      errorEl.hidden = false;
    }
    
    showToast('Failed to update booking', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  }
}

// Update booking status from dropdown
async function updateBookingStatus(bookingId, newStatus) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log(`Updating booking ${bookingId} status to: ${newStatus}`);

    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Add confirmed timestamp if status is confirmed
    if (newStatus === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
      updateData.confirmed_by = adminState.user?.id || null;
    }

    const { error } = await client
      .from('car_bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) {
      console.error('Failed to update booking status:', error);
      showToast('Błąd aktualizacji statusu: ' + error.message, 'error');
      return;
    }

    showToast(`Status zmieniony na: ${newStatus}`, 'success');

    // Reload data
    await loadCarsData();

    // Refresh modal if still open
    const modal = $('#bookingDetailsModal');
    if (modal && !modal.hidden) {
      await viewCarBookingDetails(bookingId);
    }

  } catch (e) {
    console.error('Error updating booking status:', e);
    showToast('Błąd: ' + e.message, 'error');
  }
}

// Make functions global for onclick handlers
window.viewCarBookingDetails = viewCarBookingDetails;
window.loadCarsData = loadCarsData;
window.openEditBooking = openEditBooking;
window.updateBookingStatus = updateBookingStatus;

// =====================================================
// FLEET MANAGEMENT
// =====================================================

let fleetState = {
  cars: [],
  locationFilter: '',
  typeFilter: ''
};

// Setup event delegation for car availability dropdowns
function setupFleetEventListeners() {
  console.log('🔧 Setting up fleet event listeners...');
  
  const tbody = $('#fleetTableBody');
  if (!tbody) {
    console.warn('⚠️ Fleet table body not found');
    return;
  }
  
  // Use event delegation on tbody instead of document
  tbody.removeEventListener('change', handleAvailabilityChange);
  tbody.addEventListener('change', handleAvailabilityChange);
  
  console.log('✅ Event listener attached to fleetTableBody');
}

function handleAvailabilityChange(e) {
  console.log('🎯 Change event detected on:', e.target);
  
  if (e.target && e.target.classList.contains('car-availability-select')) {
    const carId = e.target.dataset.carId;
    const newValue = e.target.value;
    console.log('🔄 Availability dropdown changed:', { carId, newValue, element: e.target });
    
    if (carId && newValue) {
      toggleCarAvailability(carId, newValue);
    } else {
      console.error('❌ Missing carId or newValue:', { carId, newValue });
    }
  }
}

async function loadFleetData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log('Loading fleet data...');

    // Build query with filters
    let query = client
      .from('car_offers')
      .select('*')
      .order('location', { ascending: true })
      .order('sort_order', { ascending: true });

    // Apply filters
    if (fleetState.locationFilter) {
      query = query.eq('location', fleetState.locationFilter);
    }
    if (fleetState.typeFilter) {
      query = query.eq('car_type', fleetState.typeFilter);
    }

    const { data: cars, error } = await query;

    if (error) {
      console.error('Error loading fleet:', error);
      throw error;
    }

    fleetState.cars = cars || [];
    console.log(`Loaded ${fleetState.cars.length} cars`);

    // Render fleet table
    const tbody = $('#fleetTableBody');
    if (!tbody) return;

    if (fleetState.cars.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="table-loading">No cars found with current filters</td></tr>';
      return;
    }

    tbody.innerHTML = fleetState.cars.map(car => {
      // Determine price display based on location
      let priceDisplay;
      if (car.location === 'paphos' && car.price_3days) {
        priceDisplay = `<div style="font-weight: 600;">€${car.price_3days}/3d</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">€${car.price_10plus_days}+/day</div>`;
      } else {
        priceDisplay = `<div style="font-weight: 600;">€${car.price_per_day}/day</div>`;
      }

      // Image display
      const imageDisplay = car.image_url 
        ? `<img src="${escapeHtml(car.image_url)}" alt="${escapeHtml(car.car_model)}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;">`
        : `<div style="width: 60px; height: 40px; background: var(--admin-border); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🚗</div>`;

      return `
        <tr>
          <td>${imageDisplay}</td>
          <td>
            <span class="badge ${car.location === 'larnaca' ? 'badge-info' : 'badge-warning'}">
              ${car.location.toUpperCase()}
            </span>
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(car.car_model)}</div>
            <div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(car.description?.substring(0, 40) || '')}${car.description?.length > 40 ? '...' : ''}</div>
          </td>
          <td>${escapeHtml(car.car_type)}</td>
          <td>${priceDisplay}</td>
          <td>
            <span class="badge ${car.transmission === 'automatic' ? 'badge-success' : 'badge-secondary'}">
              ${car.transmission}
            </span>
          </td>
          <td>${escapeHtml(car.fuel_type)}</td>
          <td>${car.max_passengers} seats</td>
          <td>
            <select 
              class="car-availability-select" 
              style="padding: 8px 12px; font-size: 13px; font-weight: 600; border: 2px solid; border-radius: 6px; cursor: pointer; min-width: 140px;
                     background-color: ${car.is_available ? '#d1fae5' : '#fee2e2'};
                     color: ${car.is_available ? '#065f46' : '#991b1b'};
                     border-color: ${car.is_available ? '#10b981' : '#ef4444'};"
              data-car-id="${car.id}"
            >
              <option value="true" ${car.is_available ? 'selected' : ''}>✓ Available</option>
              <option value="false" ${!car.is_available ? 'selected' : ''}>✗ Not Available</option>
            </select>
            ${car.stock_count ? `<div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 4px;">Stock: ${car.stock_count}</div>` : ''}
          </td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn-icon" type="button" title="Edit" onclick="editFleetCar('${car.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                </svg>
              </button>
              <button class="btn-icon" type="button" title="Delete" onclick="deleteFleetCar('${car.id}', '${escapeHtml(car.car_model)}')" style="color: var(--admin-danger);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Setup event listeners after rendering table
    setupFleetEventListeners();

  } catch (e) {
    console.error('Error loading fleet:', e);
    showToast('Failed to load fleet: ' + (e.message || 'Unknown error'), 'error');
    const tbody = $('#fleetTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" class="table-loading" style="color: var(--admin-danger);">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
  }
}

async function deleteFleetCar(carId, carModel) {
  if (!confirm(`Are you sure you want to delete ${carModel}?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    const { error } = await client
      .from('car_offers')
      .delete()
      .eq('id', carId);

    if (error) throw error;

    showToast(`${carModel} deleted successfully`, 'success');
    loadFleetData(); // Reload the list

  } catch (e) {
    console.error('Error deleting car:', e);
    showToast('Failed to delete car: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function editFleetCar(carId) {
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    // Fetch car data
    const { data: car, error } = await client
      .from('car_offers')
      .select('*')
      .eq('id', carId)
      .single();

    if (error) throw error;
    if (!car) throw new Error('Car not found');

    // Open modal in edit mode
    openFleetCarModal(car);

  } catch (e) {
    console.error('Error loading car for edit:', e);
    showToast('Failed to load car: ' + (e.message || 'Unknown error'), 'error');
  }
}

function openFleetCarModal(carData = null) {
  const modal = $('#fleetCarModal');
  const title = $('#fleetCarModalTitle');
  const form = $('#fleetCarForm');
  
  if (!modal || !title || !form) return;

  // Reset form
  form.reset();
  
  const errorDiv = $('#fleetCarFormError');
  if (errorDiv) {
    errorDiv.hidden = true;
    errorDiv.textContent = '';
  }

  // Reset image preview
  resetImagePreview();
  
  // Check if we should use i18n fields
  // New cars default to i18n, existing cars use i18n if they have i18n fields
  const useI18n = carData ? (carData.car_model_i18n || carData.description_i18n) : true;
  const i18nContainer = $('#carI18nFields');
  const legacyFields = $('#carLegacyFields');
  
  if (useI18n && i18nContainer && legacyFields && window.renderI18nInput) {
    // Render i18n fields
    const carModelContainer = $('#carModelI18n');
    const carDescContainer = $('#carDescriptionI18n');
    
    if (carModelContainer) {
      carModelContainer.innerHTML = window.renderI18nInput({
        fieldName: 'car_model',
        label: 'Car Model',
        type: 'text',
        placeholder: 'e.g., Toyota Yaris (2023)',
        currentValues: carData?.car_model_i18n || {}
      });
    }
    
    if (carDescContainer) {
      carDescContainer.innerHTML = window.renderI18nInput({
        fieldName: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        placeholder: 'Short description of the car',
        currentValues: carData?.description_i18n || {}
      });
    }
    
    // Show i18n container, hide legacy fields
    i18nContainer.style.display = 'block';
    legacyFields.style.display = 'none';
  } else if (legacyFields && i18nContainer) {
    // Use legacy fields
    i18nContainer.style.display = 'none';
    legacyFields.style.display = 'block';
  }

  if (carData) {
    // Edit mode
    const modelDisplay = carData.car_model_i18n?.pl || carData.car_model_i18n?.en || carData.car_model || 'this car';
    title.textContent = `Edit ${modelDisplay}`;
    
    // Fill form with existing data
    $('#fleetCarId').value = carData.id;
    $('#fleetCarLocation').value = carData.location || '';
    $('#fleetCarType').value = carData.car_type || '';
    
    // Fill legacy fields if not using i18n
    if (!useI18n) {
      const legacyModel = $('#fleetCarModel');
      const legacyDesc = $('#fleetCarDescription');
      if (legacyModel) legacyModel.value = carData.car_model || '';
      if (legacyDesc) legacyDesc.value = carData.description || '';
    }
    
    // Pricing
    if (carData.location === 'larnaca') {
      $('#fleetCarPricePerDay').value = carData.price_per_day || '';
    } else if (carData.location === 'paphos') {
      $('#fleetCarPrice3Days').value = carData.price_3days || '';
      $('#fleetCarPrice4_6Days').value = carData.price_4_6days || '';
      $('#fleetCarPrice7_10Days').value = carData.price_7_10days || '';
      $('#fleetCarPrice10PlusDays').value = carData.price_10plus_days || '';
    }
    
    $('#fleetCarDeposit').value = carData.deposit_amount || 200;
    $('#fleetCarInsurance').value = carData.insurance_per_day || 17;
    
    // Specs
    $('#fleetCarTransmission').value = carData.transmission || 'manual';
    $('#fleetCarFuelType').value = carData.fuel_type || 'petrol';
    $('#fleetCarCurrency').value = carData.currency || 'EUR';
    $('#fleetCarMaxPassengers').value = carData.max_passengers || 5;
    $('#fleetCarMaxLuggage').value = carData.max_luggage || 2;
    $('#fleetCarStockCount').value = carData.stock_count || 1;
    $('#fleetCarSortOrder').value = carData.sort_order || 1000;
    
    // Image and availability
    $('#fleetCarImageUrl').value = carData.image_url || '';
    $('#fleetCarIsAvailable').checked = carData.is_available !== false;
    
    // Show existing image if available
    if (carData.image_url) {
      showImagePreview(carData.image_url);
    }
    
    // Features (convert JSON array to text)
    if (carData.features) {
      try {
        const featuresArray = typeof carData.features === 'string' 
          ? JSON.parse(carData.features) 
          : carData.features;
        $('#fleetCarFeatures').value = Array.isArray(featuresArray) 
          ? featuresArray.join('\n') 
          : '';
      } catch (e) {
        $('#fleetCarFeatures').value = '';
      }
    }
    
    // Trigger location change to show correct pricing fields
    handleLocationChange(carData.location);
    
  } else {
    // Add mode
    title.textContent = 'Add New Car';
    $('#fleetCarId').value = '';
    
    // Set defaults
    $('#fleetCarCurrency').value = 'EUR';
    $('#fleetCarTransmission').value = 'manual';
    $('#fleetCarFuelType').value = 'petrol';
    $('#fleetCarMaxPassengers').value = 5;
    $('#fleetCarMaxLuggage').value = 2;
    $('#fleetCarStockCount').value = 1;
    $('#fleetCarSortOrder').value = 1000;
    $('#fleetCarDeposit').value = 200;
    $('#fleetCarInsurance').value = 17;
    $('#fleetCarIsAvailable').checked = true;
  }

  // Show modal
  modal.hidden = false;
}

async function toggleCarAvailability(carId, isAvailable) {
  try {
    console.log('toggleCarAvailability called:', { carId, isAvailable });
    
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    // Convert string to boolean if needed
    const availableBoolean = typeof isAvailable === 'string' ? isAvailable === 'true' : !!isAvailable;
    
    console.log('Updating car availability:', { carId, availableBoolean });

    const { error } = await client
      .from('car_offers')
      .update({ is_available: availableBoolean }, { returning: 'minimal' })
      .eq('id', carId);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    showToast(availableBoolean ? '✓ Car is now visible on site' : '✗ Car hidden from site', 'success');

    // Refresh row list to reflect updated dropdown color
    await loadFleetData();
    
  } catch (e) {
    console.error('Failed to update availability:', e);
    showToast('Failed to update availability: ' + (e.message || 'Unknown error'), 'error');
    // Revert UI by reloading list
    await loadFleetData();
  }
}

// Image upload functions
function showImagePreview(imageUrl) {
  const preview = $('#fleetCarImagePreview');
  const previewImg = $('#fleetCarImagePreviewImg');
  
  if (preview && previewImg && imageUrl) {
    previewImg.src = imageUrl;
    preview.hidden = false;
  }
}

function resetImagePreview() {
  const preview = $('#fleetCarImagePreview');
  const previewImg = $('#fleetCarImagePreviewImg');
  const fileInput = $('#fleetCarImageFile');
  const progress = $('#fleetCarImageUploadProgress');
  
  if (preview) preview.hidden = true;
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
  if (progress) progress.hidden = true;
  
  $('#fleetCarImageUrl').value = '';
}

function removeCarImage() {
  resetImagePreview();
  showToast('Image removed. Save the form to apply changes.', 'info');
}

async function uploadCarImage(file) {
  const client = ensureSupabase();
  if (!client) throw new Error('Database connection not available');

  // Validate file
  if (!file) throw new Error('No file selected');
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const ext = file.name.split('.').pop();
  const filename = `car-${timestamp}-${randomStr}.${ext}`;

  // Show progress
  const progressDiv = $('#fleetCarImageUploadProgress');
  const progressBar = $('#fleetCarImageUploadProgressBar');
  const statusText = $('#fleetCarImageUploadStatus');
  
  if (progressDiv) progressDiv.hidden = false;
  if (statusText) statusText.textContent = 'Uploading...';
  if (progressBar) progressBar.style.width = '30%';

  try {
    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from('car-images')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    if (progressBar) progressBar.style.width = '100%';
    if (statusText) statusText.textContent = 'Upload complete!';

    // Get public URL
    const { data: urlData } = client.storage
      .from('car-images')
      .getPublicUrl(filename);

    if (!urlData || !urlData.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    console.log('Image uploaded successfully:', urlData.publicUrl);

    // Set the URL in hidden field
    $('#fleetCarImageUrl').value = urlData.publicUrl;
    
    // Show preview
    showImagePreview(urlData.publicUrl);

    // Hide progress after a moment
    setTimeout(() => {
      if (progressDiv) progressDiv.hidden = true;
      if (progressBar) progressBar.style.width = '0%';
    }, 1500);

    showToast('Image uploaded successfully!', 'success');
    
    return urlData.publicUrl;

  } catch (e) {
    if (progressBar) progressBar.style.width = '0%';
    if (statusText) statusText.textContent = 'Upload failed';
    if (progressDiv) {
      setTimeout(() => {
        progressDiv.hidden = true;
      }, 3000);
    }
    throw e;
  }
}

function handleImageFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  uploadCarImage(file).catch(e => {
    console.error('Upload error:', e);
    showToast('Failed to upload image: ' + (e.message || 'Unknown error'), 'error');
    // Reset file input
    event.target.value = '';
  });
}

function handleUseImageUrl() {
  const urlInput = $('#fleetCarImageUrlInput');
  if (!urlInput) return;

  const imageUrl = urlInput.value.trim();
  if (!imageUrl) {
    showToast('Please enter an image URL', 'warning');
    return;
  }

  // Validate URL
  try {
    new URL(imageUrl);
  } catch (e) {
    showToast('Invalid URL format', 'error');
    return;
  }

  // Set URL and show preview
  $('#fleetCarImageUrl').value = imageUrl;
  showImagePreview(imageUrl);
  urlInput.value = '';
  showToast('Image URL set successfully', 'success');
}

// Make functions global
window.removeCarImage = removeCarImage;
window.handleImageFileChange = handleImageFileChange;
window.handleUseImageUrl = handleUseImageUrl;

function closeFleetCarModal() {
  const modal = $('#fleetCarModal');
  if (modal) modal.hidden = true;
}

function handleLocationChange(location) {
  const larnacaPricing = $('#larnacaPricing');
  const paphosPricing = $('#paphosPricing');
  
  if (!larnacaPricing || !paphosPricing) return;

  if (location === 'larnaca') {
    larnacaPricing.hidden = false;
    paphosPricing.hidden = true;
    
    // Make Larnaca field required
    const pricePerDay = $('#fleetCarPricePerDay');
    if (pricePerDay) pricePerDay.required = true;
    
    // Remove Paphos field requirements
    $('#fleetCarPrice3Days').required = false;
    
  } else if (location === 'paphos') {
    larnacaPricing.hidden = true;
    paphosPricing.hidden = false;
    
    // Remove Larnaca field requirement
    const pricePerDay = $('#fleetCarPricePerDay');
    if (pricePerDay) pricePerDay.required = false;
    
    // Make Paphos 3-day price required
    $('#fleetCarPrice3Days').required = true;
    
  } else {
    // No location selected
    larnacaPricing.hidden = true;
    paphosPricing.hidden = true;
  }
}

async function handleFleetCarSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const errorDiv = $('#fleetCarFormError');
  const submitBtn = $('#fleetCarFormSubmit');
  
  try {
    if (submitBtn) submitBtn.disabled = true;
    if (errorDiv) errorDiv.hidden = true;

    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    // Get form data
    const carId = $('#fleetCarId').value;
    const location = $('#fleetCarLocation').value;
    
    // Check if using i18n fields
    const usingI18n = $('#carI18nFields')?.style.display !== 'none';
    let carModel, description;
    let carModelI18n, descriptionI18n;
    
    if (usingI18n && window.extractI18nValues) {
      // Extract i18n values
      const formData = new FormData(form);
      carModelI18n = window.extractI18nValues(formData, 'car_model');
      descriptionI18n = window.extractI18nValues(formData, 'description');
      
      // Validate i18n fields
      const modelError = window.validateI18nField(carModelI18n, 'Car Model');
      if (modelError) {
        throw new Error(modelError);
      }
      
      // Use Polish as fallback for backward compatibility
      carModel = carModelI18n?.pl || '';
      description = descriptionI18n?.pl || '';
    } else {
      // Use legacy fields
      carModel = ($('#fleetCarModel')?.value || '').trim();
      description = ($('#fleetCarDescription')?.value || '').trim();
      
      if (!carModel) {
        throw new Error('Car Model is required');
      }
    }
    
    // Build car object
    const carData = {
      location: location,
      car_type: $('#fleetCarType').value,
      car_model: carModel,
      description: description,
      transmission: $('#fleetCarTransmission').value,
      fuel_type: $('#fleetCarFuelType').value,
      currency: $('#fleetCarCurrency').value,
      max_passengers: parseInt($('#fleetCarMaxPassengers').value) || 5,
      max_luggage: parseInt($('#fleetCarMaxLuggage').value) || 2,
      stock_count: parseInt($('#fleetCarStockCount').value) || 1,
      sort_order: parseInt($('#fleetCarSortOrder').value) || 1000,
      deposit_amount: parseFloat($('#fleetCarDeposit').value) || 0,
      insurance_per_day: parseFloat($('#fleetCarInsurance').value) || 0,
      image_url: $('#fleetCarImageUrl').value || null,
      is_available: $('#fleetCarIsAvailable').checked
    };
    
    // Add i18n fields if available
    if (usingI18n) {
      if (carModelI18n) carData.car_model_i18n = carModelI18n;
      if (descriptionI18n) carData.description_i18n = descriptionI18n;
    }

    // Location-specific pricing
    if (location === 'larnaca') {
      carData.price_per_day = parseFloat($('#fleetCarPricePerDay').value) || 0;
      carData.price_3days = null;
      carData.price_4_6days = null;
      carData.price_7_10days = null;
      carData.price_10plus_days = null;
    } else if (location === 'paphos') {
      carData.price_per_day = parseFloat($('#fleetCarPrice3Days').value) || 0; // Use 3-day as base
      carData.price_3days = parseFloat($('#fleetCarPrice3Days').value) || 0;
      carData.price_4_6days = parseFloat($('#fleetCarPrice4_6Days').value) || 0;
      carData.price_7_10days = parseFloat($('#fleetCarPrice7_10Days').value) || 0;
      carData.price_10plus_days = parseFloat($('#fleetCarPrice10PlusDays').value) || 0;
    }

    // Parse features from textarea (one per line)
    const featuresText = $('#fleetCarFeatures').value.trim();
    if (featuresText) {
      const featuresArray = featuresText
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);
      carData.features = featuresArray;
    } else {
      carData.features = [];
    }

    // Insert or Update
    let result;
    if (carId) {
      // Update existing car (no select to avoid 406 when zero rows are returned)
      const { error } = await client
        .from('car_offers')
        .update(carData, { returning: 'minimal' })
        .eq('id', carId);

      if (error) throw error;

      result = { id: carId, ...carData };
      showToast(`${carData.car_model} updated successfully`, 'success');
    } else {
      // Insert new car
      const { data, error } = await client
        .from('car_offers')
        .insert([carData])
        .select()
        .single();
      
      if (error) throw error;
      result = data;
      
      showToast(`${carData.car_model} added successfully`, 'success');
    }

    console.log('Car saved:', result);

    // Close modal and refresh list
    closeFleetCarModal();
    loadFleetData();

  } catch (e) {
    console.error('Error saving car:', e);
    
    if (errorDiv) {
      errorDiv.textContent = 'Failed to save car: ' + (e.message || 'Unknown error');
      errorDiv.hidden = false;
    }
    
    showToast('Failed to save car: ' + (e.message || 'Unknown error'), 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Make functions global
window.openFleetCarModal = openFleetCarModal;
window.closeFleetCarModal = closeFleetCarModal;
window.handleLocationChange = handleLocationChange;
window.handleFleetCarSubmit = handleFleetCarSubmit;
window.toggleCarAvailability = toggleCarAvailability;

function switchCarsTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.cars-tab-button').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.style.borderBottom = isActive ? '2px solid var(--admin-primary)' : '2px solid transparent';
    btn.style.color = isActive ? 'var(--admin-primary)' : 'var(--admin-text-muted)';
  });

  // Show/hide tab content
  const bookingsTab = $('#carsTabBookings');
  const fleetTab = $('#carsTabFleet');

  if (bookingsTab) bookingsTab.hidden = (tab !== 'bookings');
  if (fleetTab) fleetTab.hidden = (tab !== 'fleet');

  // Update action buttons
  const btnAddCar = $('#btnAddCar');
  const btnRefreshCars = $('#btnRefreshCars');
  
  if (tab === 'bookings') {
    if (btnAddCar) {
      btnAddCar.textContent = 'New Booking';
      btnAddCar.onclick = () => showToast('Add new car booking - coming soon', 'info');
    }
    if (btnRefreshCars) {
      btnRefreshCars.onclick = () => loadCarsData();
    }
    loadCarsData();
  } else if (tab === 'fleet') {
    if (btnAddCar) {
      btnAddCar.textContent = 'Add New Car';
      btnAddCar.onclick = () => openFleetCarModal();
    }
    if (btnRefreshCars) {
      btnRefreshCars.onclick = () => loadFleetData();
    }
    loadFleetData();
  }
}

// Make functions global
window.loadFleetData = loadFleetData;
window.deleteFleetCar = deleteFleetCar;
window.editFleetCar = editFleetCar;
window.switchCarsTab = switchCarsTab;

// =====================================================
// DIAGNOSTICS
// =====================================================

async function loadDiagnosticsData() {
  try {
    const client = ensureSupabase();
    
    // Check database connection
    const dbStatus = $('#dbStatus');
    try {
      if (!client) throw new Error('Client not available');
      const { error } = await client.from('profiles').select('id').limit(1);
      if (error) throw error;
      if (dbStatus) {
        dbStatus.innerHTML = '<span class="status-indicator status-ok"></span><span>Connected</span>';
      }
    } catch (error) {
      if (dbStatus) {
        dbStatus.innerHTML = '<span class="status-indicator status-error"></span><span>Error</span>';
      }
    }

    // Check API
    const apiStatus = $('#apiStatus');
    try {
      if (!client) throw new Error('Client not available');
      const { error } = await client.auth.getSession();
      if (error) throw error;
      if (apiStatus) {
        apiStatus.innerHTML = '<span class="status-indicator status-ok"></span><span>Operational</span>';
      }
    } catch (error) {
      if (apiStatus) {
        apiStatus.innerHTML = '<span class="status-indicator status-error"></span><span>Error</span>';
      }
    }

    // Check storage
    const storageStatus = $('#storageStatus');
    if (storageStatus) {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        storageStatus.innerHTML = '<span class="status-indicator status-ok"></span><span>Available</span>';
      } catch (error) {
        storageStatus.innerHTML = '<span class="status-indicator status-error"></span><span>Unavailable</span>';
      }
    }

    // Load system metrics
    if (!client) {
      console.error('Cannot load system metrics - client not available');
      return;
    }
    
    const { data: metrics, error } = await client
      .from('admin_system_diagnostics')
      .select('*');

    if (error) throw error;

    const metricsTable = $('#systemMetricsTable');
    if (!metricsTable) return;

    if (!metrics || metrics.length === 0) {
      metricsTable.innerHTML = '<tr><td colspan="3" class="table-loading">No metrics available</td></tr>';
      return;
    }

    metricsTable.innerHTML = metrics.map(metric => `
      <tr>
        <td style="font-weight: 500;">${metric.metric.replace(/_/g, ' ').toUpperCase()}</td>
        <td style="font-size: 18px; font-weight: 600;">${metric.value}</td>
        <td style="color: var(--admin-text-muted);">${metric.description}</td>
      </tr>
    `).join('');

    // Render health checks table
    await renderDiagnosticChecks();

  } catch (error) {
    console.error('Failed to load diagnostics:', error);
    showToast('Failed to load diagnostics', 'error');
  }
}

// -----------------------------------------------------
// Health Checks
// -----------------------------------------------------

 // SQL snippets used for guided Auto-Fix
 const SQL_ADD_POI_STATUS = `-- =====================================================
 -- ADD STATUS COLUMN TO POIS TABLE
 -- =====================================================
 -- This adds a status column so POIs can be draft/published/hidden
 -- =====================================================
 
 -- Add status column if it doesn't exist
 DO $$ 
 BEGIN
   IF NOT EXISTS (
     SELECT 1 FROM information_schema.columns 
     WHERE table_name = 'pois' AND column_name = 'status'
   ) THEN
     ALTER TABLE pois ADD COLUMN status TEXT DEFAULT 'published';
     RAISE NOTICE '✅ Added status column to pois table';
   ELSE
     RAISE NOTICE 'ℹ️ Status column already exists';
   END IF;
 END $$;
 
 -- Set default status to 'published' for existing POIs
 UPDATE pois SET status = 'published' WHERE status IS NULL;
 
 -- Create index for faster status queries
 CREATE INDEX IF NOT EXISTS idx_pois_status ON pois(status);
 
 -- Verify the change
 DO $$
 DECLARE
   total_count INTEGER;
   published_count INTEGER;
   draft_count INTEGER;
   hidden_count INTEGER;
 BEGIN
   SELECT 
     COUNT(*),
     COUNT(*) FILTER (WHERE status = 'published'),
     COUNT(*) FILTER (WHERE status = 'draft'),
     COUNT(*) FILTER (WHERE status = 'hidden')
   INTO total_count, published_count, draft_count, hidden_count
   FROM pois;
   
   RAISE NOTICE '✅ Status column setup complete';
   RAISE NOTICE 'Total POIs: %, Published: %, Draft: %, Hidden: %', 
     total_count, published_count, draft_count, hidden_count;
 END $$;`;
 
 const SQL_ADD_GOOGLE_URL_TO_POIS = `-- =====================================================
 -- ADD GOOGLE_URL TO POIS AND UPDATE ADMIN FUNCTIONS
 -- =====================================================
 -- This migration adds an optional google_url column to pois and
 -- updates admin_create_poi/admin_update_poi to read it from poi_data.
 -- Safe to run multiple times.
 -- =====================================================
 
 -- 1) Add column if missing
 DO $$
 BEGIN
   IF NOT EXISTS (
     SELECT 1
     FROM information_schema.columns
     WHERE table_name = 'pois'
       AND column_name = 'google_url'
   ) THEN
     ALTER TABLE pois ADD COLUMN google_url TEXT;
   END IF;
 END $$;
 
 -- 2) Recreate admin_create_poi to set google_url from poi_data
 DROP FUNCTION IF EXISTS admin_create_poi(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON);
 CREATE OR REPLACE FUNCTION admin_create_poi(
   poi_name TEXT,
   poi_description TEXT,
   poi_latitude DOUBLE PRECISION,
   poi_longitude DOUBLE PRECISION,
   poi_category TEXT DEFAULT 'other',
   poi_xp INTEGER DEFAULT 100,
   poi_data JSON DEFAULT '{}'::JSON
 )
 RETURNS JSON
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
 DECLARE
   new_poi_id TEXT;
   new_google_url TEXT;
 BEGIN
   IF NOT is_current_user_admin() THEN
     RAISE EXCEPTION 'Access denied: Admin only';
   END IF;
 
   new_poi_id := COALESCE(
     poi_data->>'slug',
     LOWER(REGEXP_REPLACE(poi_name, '[^a-zA-Z0-9]+', '-', 'g'))
   );
 
   new_google_url := NULLIF(TRIM(poi_data->>'google_url'), '');
 
   INSERT INTO pois (
     id,
     name,
     description,
     lat,
     lng,
     xp,
     badge,
     required_level,
     status,
     google_url
   ) VALUES (
     new_poi_id,
     poi_name,
     poi_description,
     poi_latitude,
     poi_longitude,
     COALESCE(poi_xp, 100),
     poi_category,
     1,
     COALESCE((poi_data->>'status')::TEXT, 'published'),
     new_google_url
   );
 
   INSERT INTO admin_actions (
     admin_id,
     action_type,
     target_user_id,
     action_data
   ) VALUES (
     auth.uid(),
     'create_poi',
     NULL,
     json_build_object('poi_id', new_poi_id)
   );
 
   RETURN json_build_object('success', true, 'poi_id', new_poi_id);
 END;
 $$;
 
 -- 3) Recreate admin_update_poi to update google_url when provided
 DROP FUNCTION IF EXISTS admin_update_poi(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON);
 CREATE OR REPLACE FUNCTION admin_update_poi(
   poi_id TEXT,
   poi_name TEXT DEFAULT NULL,
   poi_description TEXT DEFAULT NULL,
   poi_latitude DOUBLE PRECISION DEFAULT NULL,
   poi_longitude DOUBLE PRECISION DEFAULT NULL,
   poi_category TEXT DEFAULT NULL,
   poi_xp INTEGER DEFAULT NULL,
   poi_data JSON DEFAULT NULL
 )
 RETURNS JSON
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
 DECLARE
   new_google_url TEXT;
 BEGIN
   IF NOT is_current_user_admin() THEN
     RAISE EXCEPTION 'Access denied: Admin only';
   END IF;
 
   new_google_url := NULLIF(TRIM(COALESCE(poi_data->>'google_url', NULL)), '');
 
   UPDATE pois
   SET 
     name = COALESCE(poi_name, name),
     description = COALESCE(poi_description, description),
     lat = COALESCE(poi_latitude, lat),
     lng = COALESCE(poi_longitude, lng),
     badge = COALESCE(poi_category, badge),
     xp = COALESCE(poi_xp, xp),
     status = COALESCE((poi_data->>'status')::TEXT, status),
     google_url = COALESCE(new_google_url, google_url)
   WHERE id = poi_id;
 
   INSERT INTO admin_actions (
     admin_id,
     action_type,
     target_user_id,
     action_data
   ) VALUES (
     auth.uid(),
     'update_poi',
     NULL,
     json_build_object('poi_id', poi_id)
   );
 
   RETURN json_build_object('success', true, 'poi_id', poi_id);
 END;
 $$;
 
 GRANT EXECUTE ON FUNCTION admin_create_poi(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON) TO authenticated;
 GRANT EXECUTE ON FUNCTION admin_update_poi(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON) TO authenticated;`;
function getDiagnosticChecks() {
  return [
    {
      id: 'check_admin_system_diagnostics_view',
      title: 'Admin view: admin_system_diagnostics',
      description: 'View used for metrics and dashboard stats',
      run: async (client) => {
        try {
          const { data, error } = await client.from('admin_system_diagnostics').select('*').limit(1);
          if (error) throw error;
          return { status: 'ok', details: (data && data.length ? 'OK (has rows)' : 'OK (no rows)') };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_admin_users_overview_view',
      title: 'Admin view: admin_users_overview',
      description: 'Users overview used in Users tab',
      run: async (client) => {
        try {
          const { data, error } = await client.from('admin_users_overview').select('id').limit(1);
          if (error) throw error;
          return { status: 'ok', details: (data && data.length ? 'OK (has rows)' : 'OK (no rows)') };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_rpc_admin_get_content_stats',
      title: 'Function: admin_get_content_stats()',
      description: 'Returns JSON with counts and activity',
      run: async (client) => {
        try {
          const { data, error } = await client.rpc('admin_get_content_stats');
          if (error) throw error;
          const keys = data && typeof data === 'object' ? Object.keys(data).length : 0;
          return { status: 'ok', details: `OK (${keys} keys)` };
        } catch (e) {
          return { status: 'error', details: e.message || 'RPC failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_pois_missing_coordinates',
      title: 'POIs: missing/invalid coordinates',
      description: 'Detects POIs without latitude/longitude',
      run: async (client) => {
        try {
          // Detect coordinate column names: prefer lat/lng, fallback to latitude/longitude
          let cols = { lat: 'lat', lng: 'lng' };
          let probe = await client.from('pois').select('id, lat, lng').limit(1);
          if (probe.error) {
            // Try alternate schema
            const probe2 = await client.from('pois').select('id, latitude, longitude').limit(1);
            if (probe2.error) {
              return { status: 'error', details: 'Neither lat/lng nor latitude/longitude columns exist' };
            }
            cols = { lat: 'latitude', lng: 'longitude' };
          }

          const { data, error } = await client
            .from('pois')
            .select(`id, name, ${cols.lat}, ${cols.lng}`)
            .or(`${cols.lat}.is.null,${cols.lng}.is.null`)
            .limit(5);
          if (error) throw error;
          const countText = Array.isArray(data) ? `${data.length} (sample shown)` : '0';
          return { status: (data && data.length ? 'warn' : 'ok'), details: data && data.length ? `Found ${countText}` : 'OK (none found)' };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_pois_missing_google_url',
      title: 'POIs: missing Google URL',
      description: 'Detects POIs without google_url',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('pois')
            .select('id, name, google_url')
            .or('google_url.is.null,google_url.eq.')
            .limit(5);
          if (error) throw error;
          return { status: (data && data.length ? 'warn' : 'ok'), details: data && data.length ? `Found ${data.length} (sample shown)` : 'OK (none found)' };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_pois_status_column',
      title: 'POIs: status column present',
      description: 'Verifies optional column pois.status exists (draft/published/hidden)',
      run: async (client) => {
        try {
          const { error } = await client.from('pois').select('status').limit(1);
          if (error) throw error;
          return { status: 'ok', details: 'Column exists' };
        } catch (e) {
          return { status: 'warn', details: 'Missing column pois.status (run ADD_POI_STATUS_COLUMN.sql)' };
        }
      },
      canFix: true,
    },
    {
      id: 'check_pois_google_url_column',
      title: 'POIs: google_url column present',
      description: 'Verifies optional column pois.google_url exists',
      run: async (client) => {
        try {
          const { error } = await client.from('pois').select('google_url').limit(1);
          if (error) throw error;
          return { status: 'ok', details: 'Column exists' };
        } catch (e) {
          return { status: 'warn', details: 'Missing column pois.google_url (run ADD_GOOGLE_URL_TO_POIS.sql)' };
        }
      },
      canFix: true,
    },
    {
      id: 'check_admin_actions_table_access',
      title: 'Admin actions log access',
      description: 'Ensures admin_actions table is accessible for logs',
      run: async (client) => {
        try {
          const { data, error } = await client.from('admin_actions').select('id').limit(1);
          if (error) throw error;
          return { status: 'ok', details: data && data.length ? 'OK (has rows)' : 'OK (no rows yet)' };
        } catch (e) {
          return { status: 'warn', details: 'admin_actions not accessible (check policies and creation)' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_profiles_is_admin_column',
      title: 'Profiles: is_admin column present',
      description: 'Required to gate admin access',
      run: async (client) => {
        try {
          const { error } = await client.from('profiles').select('is_admin').limit(1);
          if (error) throw error;
          return { status: 'ok', details: 'Column exists' };
        } catch (e) {
          return { status: 'error', details: 'Missing column profiles.is_admin (see ADMIN_PANEL_SETUP.sql)' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_rpc_admin_get_activity_log',
      title: 'Function: admin_get_activity_log(limit_count)',
      description: 'Activity used on dashboard',
      run: async (client) => {
        try {
          const { data, error } = await client.rpc('admin_get_activity_log', { limit_count: 1 });
          if (error) throw error;
          return { status: 'ok', details: Array.isArray(data) ? `OK (${data.length} rows sample)` : 'OK' };
        } catch (e) {
          return { status: 'warn', details: e.message || 'RPC failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_rpc_admin_get_action_log',
      title: 'Function: admin_get_action_log(limit_count, action_filter)',
      description: 'Audit log function is callable',
      run: async (client) => {
        try {
          const { data, error } = await client.rpc('admin_get_action_log', { limit_count: 1, action_filter: null });
          if (error) throw error;
          return { status: 'ok', details: Array.isArray(data) ? `OK (${data.length} rows sample)` : 'OK' };
        } catch (e) {
          return { status: 'warn', details: e.message || 'RPC failed' };
        }
      },
      canFix: false,
    },
  ];
}

async function renderDiagnosticChecks() {
  const tbody = document.getElementById('diagnosticChecksTable');
  const btnRunAll = document.getElementById('btnRunAllChecks');
  if (!tbody) return;

  const client = ensureSupabase();
  const checks = getDiagnosticChecks();

  // Initial render (checking state)
  tbody.innerHTML = checks.map((c) => `
    <tr id="row-${c.id}">
      <td>
        <div class="poi-name">${escapeHtml(c.title)}</div>
        <div class="poi-slug">${escapeHtml(c.description)}</div>
      </td>
      <td id="status-${c.id}"><span class="badge badge-info">Checking...</span></td>
      <td id="details-${c.id}" style="color: var(--admin-text-muted);">—</td>
      <td>
        <div class="poi-table-actions">
          <button class="btn-secondary" data-check-run="${c.id}">Run</button>
          <button class="btn-secondary" data-check-fix="${c.id}" ${c.canFix ? '' : 'disabled'}>Auto-fix</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Attach handlers
  tbody.querySelectorAll('[data-check-run]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await runSingleCheck(btn.getAttribute('data-check-run'));
    });
  });
  tbody.querySelectorAll('[data-check-fix]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-check-fix');
      if (id === 'check_pois_status_column') {
        openDiagnosticFixModal('Auto-Fix: Add pois.status column', 'Wykonaj poniższy SQL w Supabase, aby dodać kolumnę status i indeks.', SQL_ADD_POI_STATUS);
      } else if (id === 'check_pois_google_url_column') {
        openDiagnosticFixModal('Auto-Fix: Add pois.google_url column + functions', 'Wykonaj poniższy SQL w Supabase, aby dodać kolumnę google_url oraz zaktualizować funkcje admin_create_poi/admin_update_poi.', SQL_ADD_GOOGLE_URL_TO_POIS);
      } else {
        showToast('Auto-fix not available for this check', 'info');
      }
    });
  });

  if (btnRunAll) {
    btnRunAll.addEventListener('click', runAllChecks);
  }

  // Run all once for initial statuses
  await Promise.all(checks.map(c => runSingleCheck(c.id)));
}

async function runSingleCheck(checkId) {
  const client = ensureSupabase();
  const checks = getDiagnosticChecks();
  const check = checks.find(c => c.id === checkId);
  if (!check) return;

  const statusCell = document.getElementById(`status-${check.id}`);
  const detailsCell = document.getElementById(`details-${check.id}`);
  if (statusCell) statusCell.innerHTML = '<span class="badge badge-info">Checking...</span>';
  if (detailsCell) detailsCell.textContent = '—';

  try {
    const result = await check.run(client);
    const status = result.status || 'ok';
    const details = result.details || '';
    if (statusCell) {
      const cls = status === 'ok' ? 'badge-success' : status === 'warn' ? 'badge-warning' : 'badge-danger';
      const label = status === 'ok' ? 'OK' : status === 'warn' ? 'Warning' : 'Error';
      statusCell.innerHTML = `<span class="badge ${cls}">${label}</span>`;
    }
    if (detailsCell) detailsCell.textContent = details;
  } catch (e) {
    if (statusCell) statusCell.innerHTML = '<span class="badge badge-danger">Error</span>';
    if (detailsCell) detailsCell.textContent = e.message || 'Unknown error';
  }
}

async function runAllChecks() {
  const checks = getDiagnosticChecks();
  for (const c of checks) {
    // sequential to avoid rate spikes
    // eslint-disable-next-line no-await-in-loop
    await runSingleCheck(c.id);
  }
  showToast('All checks completed', 'success');
}
 
 // -----------------------------------------------------
 // Diagnostics Auto-Fix Modal helpers
 // -----------------------------------------------------
 
 function openDiagnosticFixModal(title, description, sql) {
   const modal = document.getElementById('diagnosticFixModal');
   const titleEl = document.getElementById('diagnosticFixTitle');
   const descEl = document.getElementById('diagnosticFixDescription');
   const sqlEl = document.getElementById('diagnosticFixSql');
   if (!modal || !titleEl || !descEl || !sqlEl) return;
   titleEl.textContent = title || 'Auto-Fix';
   descEl.textContent = description || '';
   sqlEl.value = sql || '';
   showElement(modal);
 }
 
 function closeDiagnosticFixModal() {
   const modal = document.getElementById('diagnosticFixModal');
   if (modal) hideElement(modal);
 }
 
 async function copyDiagnosticSql() {
   try {
     const sqlEl = document.getElementById('diagnosticFixSql');
     if (!sqlEl) return;
     await navigator.clipboard.writeText(sqlEl.value || '');
     showToast('SQL copied to clipboard', 'success');
   } catch {
     showToast('Failed to copy SQL', 'error');
   }
 }

// =====================================================
// LOGIN
// =====================================================

async function handleAdminLogin(email, password) {
  try {
    console.log('handleAdminLogin called with email:', email);
    
    // Ensure Supabase client is available
    if (!sb) {
      sb = getSupabaseClient();
    }
    
    if (!sb) {
      throw new Error('Supabase client not available. Please refresh the page.');
    }
    
    console.log('Attempting sign in...');
    
    // Sign in with Supabase
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('Login failed - no user data');
    }

    console.log('Sign in successful! User ID:', data.user.id);
    console.log('Checking admin access...');

    // Check if user has admin access
    const hasAccess = await checkAdminAccess();
    
    if (!hasAccess) {
      console.log('Admin access denied for user:', data.user.id);
      // Access denied screen should already be showing from checkAdminAccess()
      throw new Error('You do not have admin access. Only lilkangoomedia@gmail.com is authorized.');
    }
    
    console.log('Admin access granted! Loading panel...');

  } catch (error) {
    console.error('Login failed:', error);
    
    let errorMessage = 'Login failed. Please check your credentials.';
    if (error.message) {
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address first.';
      } else if (error.message.includes('admin access')) {
        errorMessage = error.message; // Use the admin access error message
      }
    }
    
    throw new Error(errorMessage);
  }
}

// =====================================================
// LOGOUT
// =====================================================

async function handleLogout() {
  try {
    const client = ensureSupabase();
    if (client) {
      await client.auth.signOut();
    }
    
    // Clear all local storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Force redirect to login
    window.location.href = '/admin/login.html';
    
  } catch (error) {
    console.error('Logout failed:', error);
    // Force redirect anyway
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/admin/login.html';
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (error) {
    return 'Invalid date';
  }
}

function formatCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return '—';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function slugify(value) {
  if (!value) return '';

  return value
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return value
    .toString()
    .replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function initEventListeners() {
  const sidebar = $('#adminSidebar');
  const menuToggle = $('#adminMenuToggle');
  const sidebarOverlay = $('#adminSidebarOverlay');
  let mobileSidebarOpen = false;

  const updateSidebarState = (isOpen) => {
    if (!sidebar) return;

    mobileSidebarOpen = isOpen;
    sidebar.classList.toggle('is-open', isOpen);

    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.classList.toggle('is-active', isOpen);
    }

    if (sidebarOverlay) {
      if (isOpen) {
        sidebarOverlay.hidden = false;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => sidebarOverlay.classList.add('is-active'));
        } else {
          sidebarOverlay.classList.add('is-active');
        }
      } else {
        sidebarOverlay.classList.remove('is-active');
        setTimeout(() => {
          if (!mobileSidebarOpen) {
            sidebarOverlay.hidden = true;
          }
        }, 300);
      }
    }

    document.body.classList.toggle('admin-sidebar-open', isOpen);
  };

  const closeSidebarForMobile = () => {
    if (window.innerWidth <= 1024) {
      updateSidebarState(false);
    }
  };

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      updateSidebarState(!mobileSidebarOpen);
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => updateSidebarState(false));
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024 && mobileSidebarOpen) {
      updateSidebarState(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileSidebarOpen) {
      updateSidebarState(false);
    }
  });

  // Login form
  const loginForm = $('#adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const form = e.target;
      const email = form.email.value;
      const password = form.password.value;
      const submitBtn = $('#btnAdminLogin');
      const errorDiv = $('#adminLoginError');
      const btnText = submitBtn.querySelector('.btn-text');
      const btnSpinner = submitBtn.querySelector('.btn-spinner');
      
      // Disable form
      submitBtn.disabled = true;
      hideElement(btnText);
      showElement(btnSpinner);
      hideElement(errorDiv);
      
      try {
        await handleAdminLogin(email, password);
        // Success - checkAdminAccess will handle showing the panel
      } catch (error) {
        // Show error
        errorDiv.textContent = error.message || 'Login failed';
        showElement(errorDiv);
      } finally {
        // Re-enable form
        submitBtn.disabled = false;
        showElement(btnText);
        hideElement(btnSpinner);
      }
    });
  }

  // Navigation
  $$('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.dataset.view;
      if (viewName) {
        switchView(viewName);
        closeSidebarForMobile();
      }
    });
  });

  // Users pagination
  const usersPrevBtn = $('#btnUsersPrev');
  const usersNextBtn = $('#btnUsersNext');
  
  if (usersPrevBtn) {
    usersPrevBtn.addEventListener('click', () => {
      if (adminState.usersPage > 1) {
        loadUsersData(adminState.usersPage - 1);
      }
    });
  }

  if (usersNextBtn) {
    usersNextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(adminState.usersTotal / ADMIN_CONFIG.usersPerPage);
      if (adminState.usersPage < totalPages) {
        loadUsersData(adminState.usersPage + 1);
      }
    });
  }

  // User search
  const searchBtn = $('#btnUserSearch');
  const searchInput = $('#userSearch');
  
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        searchUsers(query);
      } else {
        loadUsersData(1);
      }
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchBtn.click();
      }
    });
  }

  // User detail modal
  const closeModalBtn = $('#btnCloseUserModal');
  const modalOverlay = $('#userDetailModalOverlay');
  const modal = $('#userDetailModal');

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      hideElement(modal);
    });
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', () => {
      hideElement(modal);
    });
  }

  // Comment detail modal
  const btnCloseCommentDetail = $('#btnCloseCommentDetail');
  const commentDetailOverlay = $('#commentDetailModalOverlay');
  const commentDetailModal = $('#commentDetailModal');

  if (btnCloseCommentDetail) {
    btnCloseCommentDetail.addEventListener('click', () => {
      hideElement(commentDetailModal);
    });
  }

  if (commentDetailOverlay) {
    commentDetailOverlay.addEventListener('click', () => {
      hideElement(commentDetailModal);
    });
  }

  // Comment edit modal
  const btnCloseCommentEdit = $('#btnCloseCommentEdit');
  const commentEditOverlay = $('#commentEditModalOverlay');
  const commentEditModal = $('#commentEditModal');
  const commentEditCancel = $('#commentEditCancel');

  if (btnCloseCommentEdit) {
    btnCloseCommentEdit.addEventListener('click', () => {
      hideElement(commentEditModal);
    });
  }

  if (commentEditOverlay) {
    commentEditOverlay.addEventListener('click', () => {
      hideElement(commentEditModal);
    });
  }

  if (commentEditCancel) {
    commentEditCancel.addEventListener('click', () => {
      hideElement(commentEditModal);
    });
  }

  // POI filters and actions
  const poiSearchInput = $('#poiSearchInput');
  if (poiSearchInput) {
    poiSearchInput.addEventListener('input', (event) => {
      adminState.poiSearch = event.target.value || '';
      renderPoiList();
      updatePoiTableFooter(getFilteredPois().length);
    });
  }

  const poiCategoryFilter = $('#poiCategoryFilter');
  if (poiCategoryFilter) {
    poiCategoryFilter.addEventListener('change', (event) => {
      adminState.poiFilterCategory = event.target.value;
      renderPoiList();
      updatePoiTableFooter(getFilteredPois().length);
    });
  }

  const poiStatusFilter = $('#poiStatusFilter');
  if (poiStatusFilter) {
    poiStatusFilter.addEventListener('change', (event) => {
      adminState.poiFilterStatus = event.target.value;
      renderPoiList();
      updatePoiTableFooter(getFilteredPois().length);
    });
  }

  const addPoiBtn = $('#btnAddPoi');
  if (addPoiBtn) {
    addPoiBtn.addEventListener('click', () => openPoiForm());
  }

  const refreshPoisBtn = $('#btnRefreshPois');
  if (refreshPoisBtn) {
    refreshPoisBtn.addEventListener('click', () => refreshPoiList());
  }

  const poiForm = $('#poiForm');
  if (poiForm) {
    poiForm.addEventListener('submit', handlePoiFormSubmit);
  }

  const poiFormCancel = $('#poiFormCancel');
  if (poiFormCancel) {
    poiFormCancel.addEventListener('click', () => closePoiForm());
  }

  const poiFormClose = $('#btnClosePoiForm');
  if (poiFormClose) {
    poiFormClose.addEventListener('click', () => closePoiForm());
  }

  const poiFormOverlay = $('#poiFormModalOverlay');
  if (poiFormOverlay) {
    poiFormOverlay.addEventListener('click', () => closePoiForm());
  }

  const poiDetailClose = $('#btnClosePoiDetail');
  if (poiDetailClose) {
    poiDetailClose.addEventListener('click', () => closePoiDetail());
  }

  const poiDetailOverlay = $('#poiDetailModalOverlay');
  if (poiDetailOverlay) {
    poiDetailOverlay.addEventListener('click', () => closePoiDetail());
  }

  // Cars tab switchers
  document.querySelectorAll('.cars-tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      switchCarsTab(btn.dataset.tab);
    });
  });

  // Fleet filters
  const fleetLocationFilter = $('#fleetLocationFilter');
  if (fleetLocationFilter) {
    fleetLocationFilter.addEventListener('change', (e) => {
      fleetState.locationFilter = e.target.value;
      loadFleetData();
    });
  }

  const fleetTypeFilter = $('#fleetTypeFilter');
  if (fleetTypeFilter) {
    fleetTypeFilter.addEventListener('change', (e) => {
      fleetState.typeFilter = e.target.value;
      loadFleetData();
    });
  }

  // Add new car to fleet
  const btnAddFleetCar = $('#btnAddFleetCar');
  if (btnAddFleetCar) {
    btnAddFleetCar.addEventListener('click', () => {
      openFleetCarModal(); // Open modal in add mode
    });
  }

  // Fleet car modal controls
  const btnCloseFleetCarModal = $('#btnCloseFleetCarModal');
  if (btnCloseFleetCarModal) {
    btnCloseFleetCarModal.addEventListener('click', closeFleetCarModal);
  }

  const fleetCarModalOverlay = $('#fleetCarModalOverlay');
  if (fleetCarModalOverlay) {
    fleetCarModalOverlay.addEventListener('click', closeFleetCarModal);
  }

  const fleetCarFormCancel = $('#fleetCarFormCancel');
  if (fleetCarFormCancel) {
    fleetCarFormCancel.addEventListener('click', closeFleetCarModal);
  }

  // Booking details modal controls
  const btnCloseBookingDetails = $('#btnCloseBookingDetails');
  if (btnCloseBookingDetails) {
    btnCloseBookingDetails.addEventListener('click', () => {
      const modal = $('#bookingDetailsModal');
      if (modal) modal.hidden = true;
    });
  }

  const bookingDetailsModalOverlay = $('#bookingDetailsModalOverlay');
  if (bookingDetailsModalOverlay) {
    bookingDetailsModalOverlay.addEventListener('click', () => {
      const modal = $('#bookingDetailsModal');
      if (modal) modal.hidden = true;
    });
  }

  const btnConfirmBooking = $('#btnConfirmBooking');
  if (btnConfirmBooking) {
    btnConfirmBooking.addEventListener('click', async () => {
      const modal = $('#bookingDetailsModal');
      const bookingId = modal?.dataset?.bookingId;
      if (!bookingId) return;

      try {
        const client = ensureSupabase();
        const { error } = await client
          .from('car_bookings')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('id', bookingId);

        if (error) throw error;

        showToast('Booking confirmed successfully!', 'success');
        modal.hidden = true;
        await loadCarsData();
      } catch (e) {
        console.error('Failed to confirm booking:', e);
        showToast('Failed to confirm booking', 'error');
      }
    });
  }

  const btnCancelBooking = $('#btnCancelBooking');
  if (btnCancelBooking) {
    btnCancelBooking.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to cancel this booking?')) return;

      const modal = $('#bookingDetailsModal');
      const bookingId = modal?.dataset?.bookingId;
      if (!bookingId) return;

      try {
        const client = ensureSupabase();
        const { error } = await client
          .from('car_bookings')
          .update({ status: 'cancelled' })
          .eq('id', bookingId);

        if (error) throw error;

        showToast('Booking cancelled', 'info');
        modal.hidden = true;
        await loadCarsData();
      } catch (e) {
        console.error('Failed to cancel booking:', e);
        showToast('Failed to cancel booking', 'error');
      }
    });
  }

  const btnEditBooking = $('#btnEditBooking');
  if (btnEditBooking) {
    btnEditBooking.addEventListener('click', () => {
      const modal = $('#bookingDetailsModal');
      const bookingId = modal?.dataset?.bookingId;
      if (bookingId) {
        openEditBooking(bookingId);
      }
    });
  }

  // Edit booking modal controls
  const btnCloseEditBooking = $('#btnCloseEditBooking');
  if (btnCloseEditBooking) {
    btnCloseEditBooking.addEventListener('click', () => {
      const modal = $('#editBookingModal');
      if (modal) modal.hidden = true;
    });
  }

  const editBookingModalOverlay = $('#editBookingModalOverlay');
  if (editBookingModalOverlay) {
    editBookingModalOverlay.addEventListener('click', () => {
      const modal = $('#editBookingModal');
      if (modal) modal.hidden = true;
    });
  }

  const editBookingCancel = $('#editBookingCancel');
  if (editBookingCancel) {
    editBookingCancel.addEventListener('click', () => {
      const modal = $('#editBookingModal');
      if (modal) modal.hidden = true;
    });
  }

  const editBookingForm = $('#editBookingForm');
  if (editBookingForm) {
    editBookingForm.addEventListener('submit', handleEditBookingSubmit);
  }

  // Image upload controls
  const fleetCarImageFile = $('#fleetCarImageFile');
  if (fleetCarImageFile) {
    fleetCarImageFile.addEventListener('change', handleImageFileChange);
  }

  const btnRemoveCarImage = $('#btnRemoveCarImage');
  if (btnRemoveCarImage) {
    btnRemoveCarImage.addEventListener('click', removeCarImage);
  }

  const btnUseImageUrl = $('#btnUseImageUrl');
  if (btnUseImageUrl) {
    btnUseImageUrl.addEventListener('click', handleUseImageUrl);
  }

  // Cars actions (will be updated by switchCarsTab)
  const refreshCarsBtn = $('#btnRefreshCars');
  if (refreshCarsBtn) {
    refreshCarsBtn.addEventListener('click', () => loadCarsData());
  }

  const addCarBtn = $('#btnAddCar');
  if (addCarBtn) {
    addCarBtn.addEventListener('click', () => {
      showToast('Add new car booking - coming soon', 'info');
    });
  }

  // Logout
  const logoutBtn = $('#btnAdminLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Diagnostics Auto-Fix modal
  const btnCloseDiagnosticFix = $('#btnCloseDiagnosticFix');
  const diagnosticFixOverlay = $('#diagnosticFixModalOverlay');
  const btnCopyDiagnosticSql = $('#btnCopyDiagnosticSql');
  if (btnCloseDiagnosticFix) {
    btnCloseDiagnosticFix.addEventListener('click', () => closeDiagnosticFixModal());
  }
  if (diagnosticFixOverlay) {
    diagnosticFixOverlay.addEventListener('click', () => closeDiagnosticFixModal());
  }
  if (btnCopyDiagnosticSql) {
    btnCopyDiagnosticSql.addEventListener('click', () => copyDiagnosticSql());
  }
}

async function searchUsers(query) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    adminState.usersPage = 1;

    const { data: users, error } = await client
      .from('admin_users_overview')
      .select('*')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%,name.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(ADMIN_CONFIG.usersPerPage);

    if (error) throw error;

    const tableBody = $('#usersTable');
    if (!tableBody) return;

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No users found</td></tr>';
      return;
    }

    tableBody.innerHTML = users.map(user => `
      <tr>
        <td>
          ${user.username || 'N/A'}
          ${user.is_admin ? '<span class="badge badge-admin">ADMIN</span>' : ''}
        </td>
        <td>${user.email || 'N/A'}</td>
        <td>${user.level || 0}</td>
        <td>${user.xp || 0}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <span class="badge ${user.banned_until ? 'badge-danger' : 'badge-success'}">
            ${user.banned_until ? 'Banned' : 'Active'}
          </span>
        </td>
        <td>
          <button class="btn-secondary" onclick="viewUserDetails('${user.id}')">
            View
          </button>
        </td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('User search failed:', error);
    showToast('Search failed', 'error');
  }
}

// =====================================================
// ADVANCED ADMIN FUNCTIONS
// =====================================================

// Adjust User XP
async function adjustUserXP(userId, xpChange, reason = 'Admin adjustment') {
  if (!confirm(`Adjust XP by ${xpChange > 0 ? '+' : ''}${xpChange}?\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Adjusting XP...', 'info');
    
    const { data, error } = await client.rpc('admin_adjust_user_xp', {
      target_user_id: userId,
      xp_change: xpChange,
      reason: reason
    });
    
    if (error) throw error;
    
    showToast(`XP adjusted: ${data.old_xp} → ${data.new_xp}`, 'success');

    // Reload users if on users view
    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    return true;

  } catch (error) {
    console.error('XP adjustment failed:', error);
    showToast('Failed to adjust XP: ' + (error.message || 'Unknown error'), 'error');

    return false;
  }
}

// Ban User
async function banUser(userId, reason = 'Violating terms', days = 30) {
  if (!confirm(`Ban this user for ${days} days?\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Banning user...', 'info');
    
    const { data, error } = await client.rpc('admin_ban_user', {
      target_user_id: userId,
      ban_reason: reason,
      ban_duration: `${days} days`
    });
    
    if (error) throw error;
    
    showToast('User banned successfully', 'success');

    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    return true;

  } catch (error) {
    console.error('Ban failed:', error);
    showToast('Failed to ban user: ' + (error.message || 'Unknown error'), 'error');

    return false;
  }
}

// Unban User
async function unbanUser(userId) {
  if (!confirm('Remove ban from this user?')) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Unbanning user...', 'info');
    
    const { data, error } = await client.rpc('admin_unban_user', {
      target_user_id: userId
    });
    
    if (error) throw error;
    
    showToast('User unbanned successfully', 'success');

    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    return true;

  } catch (error) {
    console.error('Unban failed:', error);
    showToast('Failed to unban user: ' + (error.message || 'Unknown error'), 'error');

    return false;
  }
}

// =====================================================
// POI MANAGEMENT
// =====================================================

const DEFAULT_POI_RADIUS = 150;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function setPoiTableLoading(isLoading) {
  const tableBody = $('#poisTableBody');
  if (!tableBody) return;

  if (isLoading) {
    tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading POIs...</td></tr>';
  }
}

function updatePoiDataSourceBadge() {
  const badge = $('#poiDataSourceBadge');
  if (!badge) return;

  if (!adminState.poisLoaded || adminState.poiLoading) {
    badge.hidden = true;
    return;
  }

  badge.hidden = false;
  badge.textContent = adminState.poiDataSource === 'supabase' ? 'Live database' : 'Static dataset';
}

function safeParsePoiData(value) {
  if (!value) return {};

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('Failed to parse POI data payload:', error);
    }
  }

  return {};
}

function normalizePoi(rawPoi, source = 'supabase') {
  if (!rawPoi) return null;

  const data = safeParsePoiData(rawPoi.data);
  const candidateSlug = data.slug || rawPoi.slug || rawPoi.identifier || rawPoi.poi_id || rawPoi.id;
  const name = rawPoi.name || data.name || 'Unnamed POI';
  const slug = (typeof candidateSlug === 'string' && candidateSlug.trim())
    ? candidateSlug.trim()
    : slugify(name);

  const id = rawPoi.id || data.id || slug;

  const latitude = parseFloat(
    rawPoi.latitude
      ?? rawPoi.lat
      ?? data.latitude
      ?? data.lat
      ?? data.location?.lat
      ?? data.location?.latitude
      ?? rawPoi.location?.lat
      ?? rawPoi.location?.latitude
      ?? NaN
  );

  const longitude = parseFloat(
    rawPoi.longitude
      ?? rawPoi.lon
      ?? rawPoi.lng
      ?? data.longitude
      ?? data.lon
      ?? data.lng
      ?? data.location?.lng
      ?? data.location?.lon
      ?? data.location?.longitude
      ?? rawPoi.location?.lng
      ?? rawPoi.location?.lon
      ?? rawPoi.location?.longitude
      ?? NaN
  );

  const radius = parseInt(
    rawPoi.radius
      ?? rawPoi.geofence_radius
      ?? rawPoi.geofenceRadius
      ?? data.radius
      ?? data.geofence_radius
      ?? data.geofenceRadius
      ?? DEFAULT_POI_RADIUS,
    10
  );

  const xp = parseInt(
    rawPoi.xp
      ?? data.xp
      ?? 100,
    10
  );

  const requiredLevel = parseInt(
    rawPoi.required_level
      ?? rawPoi.requiredLevel
      ?? data.required_level
      ?? data.requiredLevel
      ?? 1,
    10
  );

  const combinedTags = [
    ...(Array.isArray(data.tags) ? data.tags : []),
    ...(Array.isArray(rawPoi.tags) ? rawPoi.tags : []),
  ];

  const tags = combinedTags.length
    ? combinedTags
    : typeof data.tags === 'string'
      ? data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      : typeof rawPoi.tags === 'string'
        ? rawPoi.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

  const derivedStatus = rawPoi.is_hidden
    ? 'hidden'
    : rawPoi.is_draft
      ? 'draft'
      : rawPoi.is_published === false
        ? 'draft'
        : null;

  // Default to 'published' for all sources unless explicitly set otherwise
  const status = (data.status || rawPoi.status || derivedStatus || 'published')
    .toString()
    .toLowerCase();

  const category = (
    rawPoi.category
    || rawPoi.badge
    || data.category
    || data.badge
    || rawPoi.poi_category
    || data.poi_category
    || 'uncategorized'
  ).toString().toLowerCase();

  // Prefer explicit google_url field; otherwise compute a default Google Maps link
  const googleUrl = (
    rawPoi.google_url
    || data.google_url
    || (Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : null)
  );

  return {
    id,
    uuid: isUuid(id) ? id : (isUuid(rawPoi.uuid) ? rawPoi.uuid : (isUuid(data.id) ? data.id : null)),
    slug,
    name,
    description: rawPoi.description || data.description || '',
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    radius: Number.isFinite(radius) ? radius : null,
    xp: Number.isFinite(xp) ? xp : 100,
    requiredLevel: Number.isFinite(requiredLevel) ? requiredLevel : 1,
    category,
    badge: rawPoi.badge || data.badge || category,
    status,
    tags,
    google_url: googleUrl,
    // i18n fields
    name_i18n: rawPoi.name_i18n || null,
    description_i18n: rawPoi.description_i18n || null,
    badge_i18n: rawPoi.badge_i18n || null,
    created_at: rawPoi.created_at || data.created_at || null,
    updated_at: rawPoi.updated_at || data.updated_at || rawPoi.created_at || null,
    source,
    raw: rawPoi,
  };
}

function formatCategoryLabel(category) {
  if (!category) return 'Uncategorized';
  return category
    .toString()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function findPoi(poiId) {
  if (!poiId) return null;
  return adminState.pois.find(poi => poi.id === poiId || poi.slug === poiId) || null;
}

function getFilteredPois() {
  const search = adminState.poiSearch.trim().toLowerCase();
  const filterCategory = adminState.poiFilterCategory;
  const filterStatus = adminState.poiFilterStatus;

  return adminState.pois.filter(poi => {
    const matchesCategory = filterCategory === 'all' || (poi.category || 'uncategorized') === filterCategory;
    const matchesStatus = filterStatus === 'all' || (poi.status || 'published') === filterStatus;
    const matchesSearch =
      !search ||
      (poi.name && poi.name.toLowerCase().includes(search)) ||
      (poi.slug && poi.slug.toLowerCase().includes(search)) ||
      (poi.description && poi.description.toLowerCase().includes(search));
    return matchesCategory && matchesStatus && matchesSearch;
  });
}

function updatePoiFilterOptions() {
  const categorySelect = $('#poiCategoryFilter');
  if (!categorySelect) return;

  const categories = Array.from(
    new Set(adminState.pois.map(poi => poi.category || 'uncategorized'))
  ).sort();

  const currentValue = adminState.poiFilterCategory;
  const options = ['all', ...categories];
  categorySelect.innerHTML = options
    .map(category => `<option value="${category}">${category === 'all' ? 'All categories' : formatCategoryLabel(category)}</option>`)
    .join('');

  if (options.includes(currentValue)) {
    categorySelect.value = currentValue;
  } else {
    categorySelect.value = 'all';
    adminState.poiFilterCategory = 'all';
  }
}

function updatePoiStats() {
  const totalEl = $('#poiStatTotal');
  const publishedEl = $('#poiStatPublished');
  const draftsEl = $('#poiStatDrafts');
  const missingEl = $('#poiStatMissingLocation');
  const statusEl = $('#poiStatLiveStatus');

  const total = adminState.pois.length;
  const published = adminState.pois.filter(poi => poi.status === 'published').length;
  const drafts = adminState.pois.filter(poi => poi.status !== 'published').length;
  const missingLocation = adminState.pois.filter(poi => !Number.isFinite(poi.latitude) || !Number.isFinite(poi.longitude)).length;

  if (totalEl) totalEl.textContent = total;
  if (publishedEl) publishedEl.textContent = published;
  if (draftsEl) draftsEl.textContent = drafts;
  if (missingEl) missingEl.textContent = missingLocation;
  if (statusEl) {
    statusEl.textContent = adminState.poiDataSource === 'supabase'
      ? 'Live Supabase data'
      : 'Static dataset (read-only)';
  }

  updatePoiDataSourceBadge();
}

function updatePoiTableFooter(filteredCount) {
  const footer = $('#poiTableFooter');
  if (!footer) return;

  if (!adminState.poisLoaded) {
    footer.textContent = '';
    return;
  }

  const total = adminState.pois.length;
  const sourceLabel = adminState.poiDataSource === 'supabase' ? 'Supabase (live)' : 'Static JSON fallback';
  footer.innerHTML = `
    <span>Showing <strong>${filteredCount}</strong> of <strong>${total}</strong> POIs.</span>
    <span>Source: ${sourceLabel}</span>
  `;
}

function renderPoiList() {
  const tableBody = $('#poisTableBody');
  if (!tableBody) return;

  if (!adminState.poisLoaded) {
    setPoiTableLoading(true);
    return;
  }

  const filtered = getFilteredPois();

  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">No POIs match the current filters.</td></tr>';
    updatePoiTableFooter(0);
    return;
  }

  tableBody.innerHTML = filtered.map(poi => {
    const statusPill = `<span class="poi-pill poi-pill--${poi.status}">${poi.status.toUpperCase()}</span>`;
    const sourcePill = poi.source === 'static' ? '<span class="poi-pill poi-pill--static">STATIC</span>' : '';
    const tags = poi.tags && poi.tags.length
      ? poi.tags.map(tag => `<span class="badge badge-info">${escapeHtml(tag)}</span>`).join(' ')
      : '';

    return `
      <tr>
        <td>
          <div class="poi-name">${escapeHtml(poi.name)}</div>
          <div class="poi-slug">${escapeHtml(poi.slug)}</div>
          <div class="poi-meta">
            ${statusPill}
            ${sourcePill}
            ${tags}
          </div>
        </td>
        <td>${formatCategoryLabel(poi.category)}</td>
        <td>${formatCoordinates(poi.latitude, poi.longitude)}</td>
        <td>${poi.radius ? `${poi.radius} m` : '—'}</td>
        <td>${poi.updated_at ? formatDate(poi.updated_at) : poi.created_at ? formatDate(poi.created_at) : '—'}</td>
        <td>
          <div class="poi-table-actions">
            <button class="btn-icon" type="button" title="View details" onclick="viewPoiDetails('${poi.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Edit POI" onclick="editPoi('${poi.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Delete POI" onclick="deletePoi('${poi.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updatePoiTableFooter(filtered.length);
}

async function loadPoisData(forceRefresh = false) {
  if (adminState.poiLoading) {
    return;
  }

  if (!forceRefresh && adminState.poisLoaded) {
    renderPoiList();
    updatePoiStats();
    updatePoiTableFooter(getFilteredPois().length);
    updatePoiFilterOptions();
    return;
  }

  adminState.poiLoading = true;
  setPoiTableLoading(true);

  let loaded = false;
  const client = ensureSupabase();

  if (client) {
    try {
      const { data: pois, error } = await client
        .from('pois')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (Array.isArray(pois)) {
        adminState.pois = pois.map(poi => normalizePoi(poi, 'supabase')).filter(Boolean);
        adminState.poiDataSource = 'supabase';
        loaded = true;
      }
    } catch (error) {
      console.error('Failed to load POIs from Supabase:', error);
      showToast('Live POI data unavailable. Loading static dataset.', 'warning');
    }
  }

  if (!loaded) {
    try {
      const response = await fetch('/assets/pois.json');
      if (!response.ok) {
        throw new Error('Failed to load static POIs');
      }
      const staticPois = await response.json();
      adminState.pois = Array.isArray(staticPois)
        ? staticPois.map(poi => normalizePoi(poi, 'static')).filter(Boolean)
        : [];
      adminState.poiDataSource = 'static';
    } catch (error) {
      console.error('Failed to load fallback POIs:', error);
      adminState.pois = [];
      adminState.poiDataSource = 'static';
      showToast('Unable to load POIs', 'error');
    }
  }

  adminState.poiLoading = false;
  adminState.poisLoaded = true;

  updatePoiFilterOptions();
  updatePoiStats();
  renderPoiList();
}

function viewPoiDetails(poiId) {
  const poi = findPoi(poiId);
  if (!poi) {
    showToast('POI not found', 'error');
    return;
  }

  adminState.selectedPoi = poi;

  const title = $('#poiDetailTitle');
  const content = $('#poiDetailContent');
  const modal = $('#poiDetailModal');

  if (title) {
    title.textContent = poi.name;
  }

  if (content) {
    const tags = poi.tags && poi.tags.length
      ? poi.tags.map(tag => `<span class="badge badge-info">${escapeHtml(tag)}</span>`).join(' ')
      : '<span style="color: var(--admin-text-muted);">No tags</span>';

    const description = poi.description
      ? escapeHtml(poi.description).replace(/\n/g, '<br />')
      : '<span style="color: var(--admin-text-muted);">No description provided.</span>';

    const mapLink = poi.latitude && poi.longitude
      ? `<a class="btn-secondary" href="https://maps.google.com/?q=${poi.latitude},${poi.longitude}" target="_blank" rel="noopener">Open in Google Maps</a>`
      : '';

    content.innerHTML = `
      <div class="poi-detail-grid">
        <div class="poi-detail-section">
          <h4>Overview</h4>
          <div class="poi-detail-list">
            <div><strong>Slug:</strong> ${escapeHtml(poi.slug)}</div>
            <div><strong>Category:</strong> ${formatCategoryLabel(poi.category)}</div>
            <div><strong>Status:</strong> ${poi.status.toUpperCase()}</div>
            <div><strong>Radius:</strong> ${poi.radius ? poi.radius + ' m' : '—'}</div>
            <div><strong>XP Reward:</strong> ${poi.xp ?? 100} XP</div>
          </div>
        </div>
        <div class="poi-detail-section">
          <h4>Location</h4>
          <div class="poi-detail-list">
            <div><strong>Latitude:</strong> ${poi.latitude ?? '—'}</div>
            <div><strong>Longitude:</strong> ${poi.longitude ?? '—'}</div>
            <div><strong>Coordinates:</strong> ${formatCoordinates(poi.latitude, poi.longitude)}</div>
          </div>
        </div>
        <div class="poi-detail-section">
          <h4>Metadata</h4>
          <div class="poi-detail-list">
            <div><strong>Source:</strong> ${poi.source === 'supabase' ? 'Supabase' : 'Static dataset'}</div>
            <div><strong>Created:</strong> ${poi.created_at ? formatDate(poi.created_at) : '—'}</div>
            <div><strong>Updated:</strong> ${poi.updated_at ? formatDate(poi.updated_at) : '—'}</div>
          </div>
        </div>
      </div>
      <div class="poi-detail-section">
        <h4>Description</h4>
        <div class="poi-detail-description">${description}</div>
      </div>
      <div class="poi-detail-section">
        <h4>Tags</h4>
        <div class="poi-meta">${tags}</div>
      </div>
      <div class="poi-detail-actions">
        ${mapLink}
        <button type="button" class="btn-primary" onclick="editPoi('${poi.id}')">Edit POI</button>
      </div>
    `;
  }

  if (modal) {
    showElement(modal);
  }
}

function closePoiDetail() {
  const modal = $('#poiDetailModal');
  if (modal) {
    hideElement(modal);
  }
}

function openPoiForm(poiId = null) {
  const form = $('#poiForm');
  const modal = $('#poiFormModal');
  if (!form || !modal) return;

  let poi = null;
  if (poiId) {
    poi = findPoi(poiId);
  }

  adminState.selectedPoi = poi;
  adminState.poiFormMode = poi ? 'edit' : 'create';

  form.reset();

  const title = $('#poiFormTitle');
  if (title) {
    title.textContent = poi ? 'Edit POI' : 'New POI';
  }

  // Check if we should use i18n fields
  // New POIs default to i18n, existing POIs use i18n if they have i18n fields
  const useI18n = poi ? (poi.name_i18n || poi.description_i18n) : true;
  const i18nContainer = $('#poiI18nFieldsContainer');
  const legacyNameDesc = $('#poiLegacyNameDesc');
  
  if (useI18n && i18nContainer && legacyNameDesc && window.renderI18nInput) {
    // Render i18n fields
    const nameContainer = $('#poiNameI18n');
    const descContainer = $('#poiDescriptionI18n');
    const badgeContainer = $('#poiBadgeI18n');
    
    if (nameContainer) {
      nameContainer.innerHTML = window.renderI18nInput({
        fieldName: 'name',
        label: 'Name',
        type: 'text',
        placeholder: 'e.g., Kato Paphos Archaeological Park',
        currentValues: poi?.name_i18n || {}
      });
    }
    
    if (descContainer) {
      descContainer.innerHTML = window.renderI18nInput({
        fieldName: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 4,
        placeholder: 'Detailed description',
        currentValues: poi?.description_i18n || {}
      });
    }
    
    if (badgeContainer) {
      badgeContainer.innerHTML = window.renderI18nInput({
        fieldName: 'badge',
        label: 'Badge',
        type: 'text',
        placeholder: 'e.g., Explorer, Adventurer',
        currentValues: poi?.badge_i18n || {}
      });
    }
    
    // Show i18n container, hide legacy name/description
    i18nContainer.style.display = 'block';
    legacyNameDesc.style.display = 'none';
  } else if (legacyNameDesc && i18nContainer) {
    // Use legacy name/description fields
    i18nContainer.style.display = 'none';
    legacyNameDesc.style.display = 'block';
  }

  const nameInput = $('#poiName');
  const slugInput = $('#poiSlug');
  const categoryInput = $('#poiCategory');
  const statusInput = $('#poiStatus');
  const latitudeInput = $('#poiLatitude');
  const longitudeInput = $('#poiLongitude');
  const radiusInput = $('#poiRadius');
  const xpInput = $('#poiXP');
  const googleUrlInput = $('#poiGoogleUrl');
  const tagsInput = $('#poiTags');
  const descriptionInput = $('#poiDescription');

  if (nameInput) nameInput.value = poi?.name || '';
  if (slugInput) slugInput.value = poi?.slug || '';
  if (categoryInput) categoryInput.value = poi?.category || '';
  if (statusInput) statusInput.value = poi?.status || 'published';
  if (latitudeInput) latitudeInput.value = poi?.latitude ?? '';
  if (longitudeInput) longitudeInput.value = poi?.longitude ?? '';
  if (radiusInput) radiusInput.value = poi?.radius ?? '';
  if (xpInput) xpInput.value = poi?.xp ?? '';
  if (googleUrlInput) googleUrlInput.value = poi?.google_url || '';
  if (tagsInput) tagsInput.value = poi?.tags?.join(', ') ?? '';
  if (descriptionInput) descriptionInput.value = poi?.description || '';

  const warning = $('#poiFormWarning');
  const warningText = $('#poiFormWarningText');
  const submitBtn = $('#poiFormSubmit');
  const errorEl = $('#poiFormError');

  if (errorEl) {
    hideElement(errorEl);
    errorEl.textContent = '';
  }

  if (adminState.poiDataSource !== 'supabase') {
    if (warning && warningText) {
      warningText.textContent = 'Supabase connection required. Static dataset is read-only.';
      showElement(warning);
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Read-only';
    }
  } else {
    if (warning) {
      hideElement(warning);
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = poi ? 'Save Changes' : 'Create POI';
    }
  }

  showElement(modal);
}

function closePoiForm() {
  const modal = $('#poiFormModal');
  if (modal) {
    hideElement(modal);
  }
}

async function handlePoiFormSubmit(event) {
  event.preventDefault();
  
  console.log('POI Form Submit started');

  if (adminState.poiDataSource !== 'supabase') {
    showToast('Cannot save POIs while in static mode.', 'warning');
    return;
  }

  const form = event.target;
  const submitBtn = $('#poiFormSubmit');
  const errorEl = $('#poiFormError');

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    if (errorEl) hideElement(errorEl);
    
    const formData = new FormData(form);
    
    // Check if using i18n fields
    const usingI18n = $('#poiI18nFieldsContainer')?.style.display !== 'none';
    console.log('Using i18n:', usingI18n);
    
    let name, description, badge;
    let nameI18n, descriptionI18n, badgeI18n;
    
    if (usingI18n && window.extractI18nValues) {
      // Extract i18n values
      nameI18n = window.extractI18nValues(formData, 'name');
      descriptionI18n = window.extractI18nValues(formData, 'description');
      badgeI18n = window.extractI18nValues(formData, 'badge');
      
      console.log('Extracted i18n values:', { nameI18n, descriptionI18n, badgeI18n });
      
      // DEBUG: Show all FormData entries
      console.log('FormData entries:');
      for (let [key, value] of formData.entries()) {
        if (key.includes('name') || key.includes('description') || key.includes('badge')) {
          console.log(`  ${key}: ${value}`);
        }
      }
      
      // Validate i18n fields (PL and EN required)
      if (window.validateI18nField) {
        const nameError = window.validateI18nField(nameI18n, 'Name');
        if (nameError) {
          console.log('Validation error:', nameError);
          if (errorEl) {
            errorEl.textContent = nameError;
            showElement(errorEl);
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
          }
          return;
        }
      } else {
        console.warn('window.validateI18nField not available');
      }
      
      // Use Polish as fallback for backward compatibility
      name = nameI18n?.pl || '';
      description = descriptionI18n?.pl || '';
      badge = badgeI18n?.pl || '';
    } else {
      console.log('Using legacy fields');
      // Use legacy fields
      name = (formData.get('name') || '').toString().trim();
      description = (formData.get('description') || '').toString().trim();
      badge = '';
    }
    
    const slugInput = (formData.get('slug') || '').toString().trim();
    const category = (formData.get('category') || '').toString().trim().toLowerCase() || 'uncategorized';
    const status = (formData.get('status') || 'published').toString().toLowerCase();
    const latitude = parseFloat(formData.get('latitude'));
    const longitude = parseFloat(formData.get('longitude'));
    const radiusValue = formData.get('radius');
    const radius = radiusValue ? parseInt(radiusValue, 10) : null;
    const xpValue = formData.get('xp');
    const xp = xpValue ? parseInt(xpValue, 10) : null;
    const googleUrl = (formData.get('google_url') || '').toString().trim();
    const tagsValue = (formData.get('tags') || '').toString().trim();
    const tags = tagsValue ? tagsValue.split(',').map(tag => tag.trim()).filter(Boolean) : [];

    const slug = slugInput || slugify(name);

    if (!name || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      if (errorEl) {
        errorEl.textContent = 'Name, latitude and longitude are required.';
        showElement(errorEl);
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
      }
      return;
    }

    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
      }
      return;
    }

    const payload = {
      slug,
      status,
      radius: radius || DEFAULT_POI_RADIUS,
      xp: xp || 100,
      tags,
      ...(googleUrl ? { google_url: googleUrl } : {}),
    };

    if (adminState.poiFormMode === 'create') {
      // Build insert object - MATCH database schema
      const insertData = {
        id: slug,  // 'id' column, not 'slug'
        name: name,
        description: description || null,
        lat: latitude,
        lng: longitude,
        xp: xp || 100,
        badge: badge || category || 'Explorer',  // badge column
        required_level: 1,  // default level
        status: status,
        radius: radius || DEFAULT_POI_RADIUS,
        google_url: googleUrl || null,
      };
      
      // Add i18n fields if available
      console.log('Before adding i18n - usingI18n:', usingI18n);
      console.log('nameI18n:', nameI18n, 'type:', typeof nameI18n);
      console.log('descriptionI18n:', descriptionI18n, 'type:', typeof descriptionI18n);
      console.log('badgeI18n:', badgeI18n, 'type:', typeof badgeI18n);
      
      if (usingI18n) {
        console.log('Adding i18n fields to insertData...');
        if (nameI18n) {
          console.log('Adding name_i18n:', nameI18n);
          insertData.name_i18n = nameI18n;
        }
        if (descriptionI18n) {
          console.log('Adding description_i18n:', descriptionI18n);
          insertData.description_i18n = descriptionI18n;
        }
        if (badgeI18n) {
          console.log('Adding badge_i18n:', badgeI18n);
          insertData.badge_i18n = badgeI18n;
        }
      }
      
      console.log('Creating POI with data:', JSON.stringify(insertData, null, 2));

      const { error } = await client
        .from('pois')
        .insert(insertData);

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      showToast('POI created successfully', 'success');
    } else if (adminState.selectedPoi) {
      const poi = adminState.selectedPoi;
      const poiId = poi.id; // Use poi.id (TEXT) not poi.uuid (UUID)

      // Build update object
      const updateData = {
        name: name,
        description: description || null,
        lat: latitude,
        lng: longitude,
        xp: xp,
        status: status,
        radius: radius || DEFAULT_POI_RADIUS,
        google_url: googleUrl || null,
      };
      
      // Add i18n fields if available
      if (usingI18n) {
        if (nameI18n) updateData.name_i18n = nameI18n;
        if (descriptionI18n) updateData.description_i18n = descriptionI18n;
        if (badgeI18n) updateData.badge_i18n = badgeI18n;
      }

      const { error } = await client
        .from('pois')
        .update(updateData)
        .eq('id', poiId);

      if (error) throw error;

      showToast('POI updated successfully', 'success');
    }

    // Refresh global PLACES_DATA for main site and community
    if (typeof window.refreshPoisData === 'function') {
      console.log('🔄 Refreshing global PLACES_DATA...');
      await window.refreshPoisData();
    }

    closePoiForm();
    adminState.poisLoaded = false;
    await loadPoisData(true);
  } catch (error) {
    console.error('Failed to save POI:', error);
    if (errorEl) {
      errorEl.textContent = error.message || 'Failed to save POI';
      showElement(errorEl);
    }
    showToast('Failed to save POI: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
    }
  }
}

async function deletePoi(poiId) {
  const poi = findPoi(poiId);
  if (!poi) {
    showToast('POI not found', 'error');
    return;
  }

  if (adminState.poiDataSource !== 'supabase') {
    showToast('Cannot delete POIs while in static mode.', 'warning');
    return;
  }

  if (!confirm(`Delete POI "${poi.name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) {
      throw new Error('Database connection not available');
    }

    const poiIdToDelete = poi.uuid || poi.id;
    const { error } = await client.rpc('admin_delete_poi', {
      poi_id: poiIdToDelete,
      deletion_reason: 'Admin panel removal',
    });

    if (error) throw error;

    // Refresh global PLACES_DATA for main site and community
    if (typeof window.refreshPoisData === 'function') {
      console.log('🔄 Refreshing global PLACES_DATA after delete...');
      await window.refreshPoisData();
    }

    showToast('POI deleted successfully', 'success');
    adminState.poisLoaded = false;
    await loadPoisData(true);
  } catch (error) {
    console.error('Failed to delete POI:', error);
    showToast('Failed to delete POI: ' + (error.message || 'Unknown error'), 'error');
  }
}

function editPoi(poiId) {
  openPoiForm(poiId);
}

function refreshPoiList() {
  loadPoisData(true);
}

// Delete Comment
async function deleteComment(commentId, reason = 'Content policy violation') {
  if (!confirm(`Delete this comment?\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Deleting comment...', 'info');
    
    const { data, error } = await client.rpc('admin_delete_comment', {
      comment_id: commentId,
      deletion_reason: reason
    });
    
    if (error) throw error;
    
    showToast('Comment deleted successfully', 'success');
    
    // Reload content if on content view
    if (adminState.currentView === 'content') {
      loadContentData();
    }
    
  } catch (error) {
    console.error('Delete comment failed:', error);
    showToast('Failed to delete comment: ' + (error.message || 'Unknown error'), 'error');
  }
}

// =====================================================
// CONTENT MANAGEMENT - STATE
// =====================================================
let contentState = {
  comments: [],
  currentPage: 1,
  itemsPerPage: 20,
  totalComments: 0,
  searchQuery: '',
  selectedComment: null,
  stats: null
};

// Load Content Management Data
async function loadContentData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      const statsEl = $('#contentStats');
      if (statsEl) {
        statsEl.innerHTML = '<div class="admin-error-message">❌ Database not connected. Check console for details.</div>';
      }
      return;
    }
    
    // Load statistics first
    await loadContentStats();
    
    // Load comments
    await loadComments();
    
  } catch (error) {
    console.error('Failed to load content data:', error);
    showToast('Failed to load content data: ' + error.message, 'error');
    
    // Show helpful error message
    const tableBody = $('#contentTable');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 40px; text-align: center;">
            <div style="color: var(--admin-danger); margin-bottom: 16px; font-size: 18px;">❌ Error Loading Content</div>
            <div style="color: var(--admin-text-muted); margin-bottom: 16px;">${escapeHtml(error.message)}</div>
            <div style="background: rgba(239, 68, 68, 0.1); padding: 16px; border-radius: 8px; text-align: left; max-width: 600px; margin: 0 auto;">
              <p style="margin: 0 0 8px; font-weight: 600;">Possible solutions:</p>
              <ol style="margin: 0; padding-left: 20px; color: var(--admin-text);">
                <li>Run <code>ADMIN_CONTENT_COMPLETE_INSTALL.sql</code> in Supabase SQL Editor</li>
                <li>Check if you have admin permissions (is_admin = true)</li>
                <li>Open browser console (F12) for detailed error</li>
                <li>Verify Supabase connection is working</li>
              </ol>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

// Load content statistics
async function loadContentStats() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data: stats, error } = await client.rpc('admin_get_detailed_content_stats');
    
    if (error) {
      console.error('Stats error:', error);
      throw new Error(`Stats function failed: ${error.message}. Did you run ADMIN_CONTENT_COMPLETE_INSTALL.sql?`);
    }
    
    if (!stats) {
      throw new Error('No stats data returned');
    }
    
    contentState.stats = stats;
    
    // Update stats display
    const statsEl = $('#contentStats');
    if (statsEl) {
      if (stats && stats.comments && stats.photos && stats.likes && stats.engagement) {
        statsEl.innerHTML = `
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Comments</p>
              <p class="stat-card-value">${stats.comments.total || 0}</p>
              <p class="stat-card-change">+${stats.comments.today || 0} today</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Photos</p>
              <p class="stat-card-value">${stats.photos.total || 0}</p>
              <p class="stat-card-change">${stats.comments.with_photos || 0} comments with photos</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Likes</p>
              <p class="stat-card-value">${stats.likes.total || 0}</p>
              <p class="stat-card-change">+${stats.likes.today || 0} today</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Active Users (7d)</p>
              <p class="stat-card-value">${stats.engagement.active_commenters_week || 0}</p>
              <p class="stat-card-change">Contributors this week</p>
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Failed to load content stats:', error);
    const statsEl = $('#contentStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="admin-error-message" style="grid-column: 1 / -1;">
          ⚠️ Statistics unavailable: ${escapeHtml(error.message)}
        </div>
      `;
    }
  }
}

// Load comments with filters
async function loadComments(page = 1) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const tableBody = $('#contentTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading comments...</td></tr>';
    
    contentState.currentPage = page;
    const offset = (page - 1) * contentState.itemsPerPage;
    
    const { data: comments, error } = await client.rpc('admin_get_all_comments', {
      search_query: contentState.searchQuery || null,
      poi_filter: null,
      user_filter: null,
      date_from: null,
      date_to: null,
      limit_count: contentState.itemsPerPage,
      offset_count: offset
    });
    
    if (error) {
      console.error('Comments RPC error:', error);
      throw new Error(`Failed to load comments: ${error.message}. Make sure ADMIN_CONTENT_COMPLETE_INSTALL.sql is executed.`);
    }
    
    contentState.comments = comments || [];
    
    if (comments.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No comments found</td></tr>';
      updateContentPagination(0);
      return;
    }
    
    tableBody.innerHTML = comments.map(comment => {
      const editedBadge = comment.is_edited ? '<span class="badge badge-info" title="Edited">✎</span>' : '';
      const photoBadge = comment.photo_count > 0 ? `<span class="badge badge-success">📷 ${comment.photo_count}</span>` : '';
      
      return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(comment.username)}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">Level ${comment.user_level}</div>
        </td>
        <td>
          <div style="font-weight: 500; margin-bottom: 4px;">${escapeHtml(comment.poi_name || 'Unknown POI')}</div>
          <div class="comment-preview" title="${escapeHtml(comment.comment_content)}">
            ${escapeHtml(comment.comment_content.substring(0, 80))}${comment.comment_content.length > 80 ? '...' : ''}
          </div>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${editedBadge}
            ${photoBadge}
          </div>
        </td>
        <td>❤️ ${comment.like_count}</td>
        <td>${formatDate(comment.created_at)}</td>
        <td>
          <div class="poi-table-actions">
            <button class="btn-icon" type="button" title="View details" onclick="viewCommentDetails('${comment.comment_id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Edit comment" onclick="editComment('${comment.comment_id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Delete comment" onclick="deleteComment('${comment.comment_id}')" style="color: var(--admin-danger);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
    
    // Update pagination
    updateContentPagination(comments.length);
    
  } catch (error) {
    console.error('Failed to load comments:', error);
    showToast('Failed to load comments', 'error');
    const tableBody = $('#contentTable');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">Error loading comments</td></tr>';
    }
  }
}

// Update pagination
function updateContentPagination(loadedCount) {
  const paginationEl = $('#contentPagination');
  if (!paginationEl) return;
  
  const hasMore = loadedCount === contentState.itemsPerPage;
  const hasPrev = contentState.currentPage > 1;
  
  paginationEl.innerHTML = `
    <button 
      class="btn-pagination" 
      onclick="loadComments(${contentState.currentPage - 1})" 
      ${!hasPrev ? 'disabled' : ''}>
      Previous
    </button>
    <span class="pagination-info">Page ${contentState.currentPage}</span>
    <button 
      class="btn-pagination" 
      onclick="loadComments(${contentState.currentPage + 1})" 
      ${!hasMore ? 'disabled' : ''}>
      Next
    </button>
  `;
}

// View comment details
async function viewCommentDetails(commentId) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    showToast('Loading comment details...', 'info');

    const { data, error } = await client.rpc('admin_get_comment_details', {
      comment_id: commentId
    });

    if (error) throw error;

    const comment = data.comment;
    const photos = data.photos || [];
    const likes = data.likes || { count: 0, users: [] };
    
    contentState.selectedComment = { ...data, comment_id: commentId };
    
    // Show modal
    const modal = $('#commentDetailModal');
    const title = $('#commentDetailTitle');
    const content = $('#commentDetailContent');
    
    if (title) {
      title.textContent = `Comment by ${comment.username}`;
    }
    
    if (content) {
      const photosHtml = photos.length > 0 ? `
        <div class="comment-photos-grid">
          ${photos.map(photo => `
            <div class="comment-photo-item">
              <img src="${escapeHtml(photo.photo_url)}" alt="Comment photo" onclick="window.open('${escapeHtml(photo.photo_url)}', '_blank')" style="cursor: pointer;" />
              <button class="btn-delete-photo" onclick="deleteCommentPhoto('${photo.id}')" title="Delete photo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      ` : '<p style="color: var(--admin-text-muted);">No photos</p>';
      
      const likesHtml = likes.count > 0 ? `
        <div class="likes-list">
          ${likes.users.map(user => `
            <div class="like-item">
              <span>❤️ ${user.username || 'Anonymous'}</span>
              <span style="color: var(--admin-text-muted); font-size: 12px;">${formatDate(user.liked_at)}</span>
            </div>
          `).join('')}
        </div>
      ` : '<p style="color: var(--admin-text-muted);">No likes yet</p>';
      
      content.innerHTML = `
        <div style="display: grid; gap: 24px;">
          <!-- Comment Info -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Comment Details</h4>
            <div style="background: var(--admin-bg); padding: 20px; border-radius: 8px;">
              <table style="width: 100%; color: var(--admin-text);">
                <tr>
                  <td style="padding: 8px 0; font-weight: 500; width: 120px;">POI:</td>
                  <td style="padding: 8px 0;">${escapeHtml(comment.poi_name || 'Unknown')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">User ID:</td>
                  <td style="padding: 8px 0; font-family: monospace; font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(comment.user_id || 'N/A')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Username:</td>
                  <td style="padding: 8px 0;">${escapeHtml(comment.username || 'Anonymous')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Email:</td>
                  <td style="padding: 8px 0;">${escapeHtml(comment.user_email || 'N/A')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Level & XP:</td>
                  <td style="padding: 8px 0;">Level ${comment.user_level} (${comment.user_xp} XP)</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Created:</td>
                  <td style="padding: 8px 0;">${formatDate(comment.created_at)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Updated:</td>
                  <td style="padding: 8px 0;">${comment.updated_at ? formatDate(comment.updated_at) : 'Never'}</td>
                </tr>
              </table>
            </div>
          </div>
          
          <!-- Comment Content -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Content</h4>
            <div style="background: var(--admin-bg); padding: 20px; border-radius: 8px; white-space: pre-wrap; line-height: 1.6;">
              ${escapeHtml(comment.content)}
            </div>
          </div>
          
          <!-- Photos -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Photos (${photos.length})</h4>
            ${photosHtml}
          </div>
          
          <!-- Likes -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Likes (${likes.count})</h4>
            ${likesHtml}
          </div>
          
          <!-- Actions -->
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button class="btn-primary" onclick="editComment('${commentId}'); hideElement($('#commentDetailModal'));">
              Edit Comment
            </button>
            <button class="btn-secondary" style="background: var(--admin-danger); border-color: var(--admin-danger);" onclick="deleteComment('${commentId}'); hideElement($('#commentDetailModal'));">
              Delete Comment
            </button>
          </div>
        </div>
      `;
    }
    
    showElement(modal);
    
  } catch (error) {
    console.error('Failed to load comment details:', error);
    showToast('Failed to load comment details', 'error');
  }
}

// Edit comment
function editComment(commentId) {
  const comment = contentState.comments.find(c => c.comment_id === commentId);
  if (!comment) {
    showToast('Comment not found', 'error');
    return;
  }
  
  contentState.selectedComment = { ...comment, comment_id: commentId };
  
  const modal = $('#commentEditModal');
  const title = $('#commentEditTitle');
  const textarea = $('#commentEditContent');
  const form = $('#commentEditForm');
  
  if (title) {
    title.textContent = `Edit Comment by ${comment.username}`;
  }
  
  if (textarea) {
    textarea.value = comment.comment_content;
  }
  
  showElement(modal);
}

// Handle comment edit form submission
async function handleCommentEditSubmit(event) {
  event.preventDefault();
  
  const commentId = contentState.selectedComment?.comment_id;
  if (!commentId) return;
  
  const textarea = $('#commentEditContent');
  const submitBtn = $('#commentEditSubmit');
  const errorEl = $('#commentEditError');
  
  const newContent = textarea.value.trim();
  
  if (!newContent) {
    if (errorEl) {
      errorEl.textContent = 'Comment content cannot be empty';
      showElement(errorEl);
    }
    return;
  }
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }
  
  if (errorEl) hideElement(errorEl);
  
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    
    const { error } = await client.rpc('admin_update_comment', {
      comment_id: commentId,
      new_content: newContent,
      edit_reason: 'Admin edit'
    });
    
    if (error) throw error;
    
    showToast('Comment updated successfully', 'success');
    hideElement($('#commentEditModal'));
    
    // Reload comments
    await loadComments(contentState.currentPage);
    
  } catch (error) {
    console.error('Failed to update comment:', error);
    if (errorEl) {
      errorEl.textContent = error.message || 'Failed to update comment';
      showElement(errorEl);
    }
    showToast('Failed to update comment', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  }
}

// Get Analytics Data
async function loadAnalytics() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    // Get content stats
    const { data: contentStats, error: statsError } = await client.rpc('admin_get_content_stats');
    
    if (statsError) throw statsError;
    
    // Get top contributors
    const { data: topContributors, error: contribError } = await client.rpc('admin_get_top_contributors', {
      limit_count: 10
    });
    
    if (contribError) throw contribError;
    
    // Update analytics display
    const analyticsEl = $('#analyticsContent');
    if (analyticsEl && contentStats) {
      analyticsEl.innerHTML = `
        <div class="admin-stats-grid">
          <div class="admin-stat-card">
            <h4>Comments Today</h4>
            <p style="font-size: 28px; font-weight: 700;">${contentStats.comments_today || 0}</p>
          </div>
          <div class="admin-stat-card">
            <h4>Comments This Week</h4>
            <p style="font-size: 28px; font-weight: 700;">${contentStats.comments_this_week || 0}</p>
          </div>
          <div class="admin-stat-card">
            <h4>Active Users Today</h4>
            <p style="font-size: 28px; font-weight: 700;">${contentStats.active_users_today || 0}</p>
          </div>
          <div class="admin-stat-card">
            <h4>Average Rating</h4>
            <p style="font-size: 28px; font-weight: 700;">${contentStats.avg_rating || 'N/A'}</p>
          </div>
        </div>
        
        <div class="admin-section" style="margin-top: 32px;">
          <h3>Top Contributors</h3>
          <div class="admin-table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Comments</th>
                  <th>Ratings</th>
                  <th>Visits</th>
                  <th>XP</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                ${topContributors && topContributors.length > 0 ? topContributors.map(user => `
                  <tr>
                    <td>${user.username || 'N/A'}</td>
                    <td>${user.comment_count || 0}</td>
                    <td>${user.rating_count || 0}</td>
                    <td>${user.visit_count || 0}</td>
                    <td>${user.total_xp || 0}</td>
                    <td>${user.level || 0}</td>
                  </tr>
                `).join('') : '<tr><td colspan="6" class="table-loading">No contributors found</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Failed to load analytics:', error);
    showToast('Failed to load analytics', 'error');
  }
}

// Delete comment photo
async function deleteCommentPhoto(photoId) {
  if (!confirm('Delete this photo? This action cannot be undone.')) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      throw new Error('Database connection not available');
    }
    
    showToast('Deleting photo...', 'info');
    
    const { error } = await client.rpc('admin_delete_comment_photo', {
      photo_id: photoId,
      deletion_reason: 'Admin action'
    });
    
    if (error) throw error;
    
    showToast('Photo deleted successfully', 'success');
    
    // Close detail modal and reload
    hideElement($('#commentDetailModal'));
    await loadComments(contentState.currentPage);
    
  } catch (error) {
    console.error('Failed to delete photo:', error);
    showToast('Failed to delete photo: ' + (error.message || 'Unknown error'), 'error');
  }
}

// Search comments
function searchComments() {
  const searchInput = $('#contentSearchInput');
  if (searchInput) {
    contentState.searchQuery = searchInput.value.trim();
    contentState.currentPage = 1;
    loadComments(1);
  }
}

// Clear search
function clearContentSearch() {
  const searchInput = $('#contentSearchInput');
  if (searchInput) {
    searchInput.value = '';
    contentState.searchQuery = '';
    contentState.currentPage = 1;
    loadComments(1);
  }
}

// =====================================================
// MODERATION MANAGEMENT
// =====================================================

let moderationState = {
  reports: [],
  currentPage: 1,
  itemsPerPage: 20
};

// Load moderation data
async function loadModerationData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    const tableBody = $('#moderationTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading reports...</td></tr>';
    
    // Load reported content
    const { data: reports, error } = await client
      .from('reported_content')
      .select(`
        id,
        report_type,
        reason,
        status,
        created_at,
        reporter_id,
        profiles!reporter_id(username, email),
        comment_id,
        poi_comments!comment_id(content, poi_id, user_id, profiles!user_id(username))
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(moderationState.itemsPerPage);
    
    if (error) {
      console.error('Failed to load reports:', error);
      // Try simpler query if join fails
      const { data: simpleReports, error: simpleError } = await client
        .from('reported_content')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(moderationState.itemsPerPage);
      
      if (simpleError) throw simpleError;
      
      if (!simpleReports || simpleReports.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No pending reports</td></tr>';
        return;
      }
      
      // Render simple version
      tableBody.innerHTML = simpleReports.map(report => `
        <tr>
          <td><span class="badge badge-warning">${escapeHtml(report.report_type || 'unknown')}</span></td>
          <td>Reporter ID: ${escapeHtml(report.reporter_id ? report.reporter_id.substring(0, 8) : 'N/A')}</td>
          <td>POI: ${escapeHtml(report.poi_id || 'N/A')}</td>
          <td>—</td>
          <td>${escapeHtml(report.reason || 'No reason')}</td>
          <td>${formatDate(report.created_at)}</td>
          <td>
            <div class="poi-table-actions">
              <button class="btn-secondary" onclick="resolveReport('${report.id}', 'approved')" title="Approve">✓</button>
              <button class="btn-secondary" onclick="resolveReport('${report.id}', 'rejected')" title="Reject">✗</button>
            </div>
          </td>
        </tr>
      `).join('');
      return;
    }
    
    moderationState.reports = reports || [];
    
    if (reports.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">✅ No pending reports - all clear!</td></tr>';
      return;
    }
    
    // Render full version with joins
    tableBody.innerHTML = reports.map(report => {
      const reporter = report.profiles?.username || 'Anonymous';
      const comment = report.poi_comments;
      const commentUser = comment?.profiles?.username || 'Unknown';
      const commentExcerpt = comment?.content ? comment.content.substring(0, 50) + '...' : 'N/A';
      const poiId = comment?.poi_id || 'N/A';
      
      return `
        <tr>
          <td><span class="badge badge-warning">${escapeHtml(report.report_type || 'comment')}</span></td>
          <td>${escapeHtml(reporter)}</td>
          <td>${escapeHtml(poiId)}</td>
          <td title="${escapeHtml(comment?.content || '')}">${escapeHtml(commentExcerpt)}</td>
          <td>${escapeHtml(report.reason || 'No reason')}</td>
          <td>${formatDate(report.created_at)}</td>
          <td>
            <div class="poi-table-actions">
              <button class="btn-secondary" onclick="resolveReport('${report.id}', 'approved')" title="Approve & delete content">✓ Approve</button>
              <button class="btn-secondary" onclick="resolveReport('${report.id}', 'rejected')" title="Reject report">✗ Reject</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Failed to load moderation data:', error);
    showToast('Failed to load moderation data: ' + error.message, 'error');
    
    const tableBody = $('#moderationTable');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 32px; text-align: center;">
            <div style="color: var(--admin-danger); margin-bottom: 12px;">❌ Error Loading Reports</div>
            <div style="color: var(--admin-text-muted);">${escapeHtml(error.message)}</div>
            <div style="margin-top: 16px;">
              <small>Make sure reported_content table exists in Supabase</small>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

// Resolve report
async function resolveReport(reportId, resolution) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    const action = resolution === 'approved' ? 'approved' : 'rejected';
    
    if (!confirm(`${action === 'approved' ? 'Approve this report and take action?' : 'Reject this report?'}`)) {
      return;
    }
    
    showToast('Processing...', 'info');
    
    // Update report status
    const { error } = await client
      .from('reported_content')
      .update({
        status: action,
        resolved_at: new Date().toISOString(),
        resolved_by: adminState.user?.id
      })
      .eq('id', reportId);
    
    if (error) throw error;
    
    showToast(`Report ${action} successfully`, 'success');
    
    // Reload moderation data
    await loadModerationData();
    
  } catch (error) {
    console.error('Failed to resolve report:', error);
    showToast('Failed to resolve report: ' + error.message, 'error');
  }
}

// Make functions global for onclick handlers
window.adjustUserXP = adjustUserXP;
window.banUser = banUser;
window.unbanUser = unbanUser;
window.deleteComment = deleteComment;
window.viewPoiDetails = viewPoiDetails;
window.editPoi = editPoi;
window.deletePoi = deletePoi;
window.viewCommentDetails = viewCommentDetails;
window.editComment = editComment;
window.handleCommentEditSubmit = handleCommentEditSubmit;
window.deleteCommentPhoto = deleteCommentPhoto;
window.loadComments = loadComments;
window.searchComments = searchComments;
window.clearContentSearch = clearContentSearch;
window.loadModerationData = loadModerationData;
window.resolveReport = resolveReport;

// =====================================================
// INITIALIZATION
// =====================================================

async function initAdminPanel() {
  console.log('Initializing admin panel...');
  console.log('NOTE: Auth already verified by /admin/index.html - skipping auth checks');
  
  // Initialize event listeners
  initEventListeners();
  
  // Wait for Supabase client
  let retries = 0;
  const maxRetries = 10;
  
  while (!sb && retries < maxRetries) {
    sb = getSupabaseClient();
    if (!sb) {
      console.log(`Waiting for Supabase client... (${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
  }
  
  if (!sb) {
    console.error('Failed to load Supabase client after multiple retries');
    setLoading(false);
    return;
  }
  
  console.log('Supabase client loaded successfully');
  
  // Load user session (but don't redirect - index.html already verified)
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      adminState.user = session.user;
      console.log('User session loaded:', session.user.email);
      
      // Load profile
      const { data: profile } = await sb
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profile) {
        adminState.profile = profile;
        adminState.isAdmin = profile.is_admin;
        console.log('Profile loaded:', profile.username || profile.email);
      }
      
      // Show admin panel and hide loading
      showAdminPanel();
    }
  } catch (error) {
    console.error('Error loading session:', error);
  }

  console.log('Admin panel initialized successfully');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPanel);
} else {
  initAdminPanel();
}

// =====================================================
// TRIPS TABS FUNCTIONALITY
// =====================================================

// Trips tabs switching
document.addEventListener('DOMContentLoaded', function() {
  const tripsTabButtons = document.querySelectorAll('.trips-tab-button');
  
  tripsTabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tab = this.getAttribute('data-tab');
      
      // Update active state
      tripsTabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--admin-text-muted)';
      });
      this.classList.add('active');
      this.style.borderBottomColor = 'var(--admin-primary)';
      this.style.color = 'var(--admin-text)';
      
      // Show/hide tab content
      document.getElementById('tripsTabTrips').hidden = (tab !== 'trips');
      document.getElementById('tripsTabBookings').hidden = (tab !== 'bookings');
      
      // Load data for the selected tab
      if (tab === 'bookings') {
        loadTripBookingsData();
      } else {
        loadTripsAdminData();
      }
    });
  });
  
  // Refresh button for trips
  const btnRefreshTrips = document.getElementById('btnRefreshTrips');
  if (btnRefreshTrips) {
    btnRefreshTrips.addEventListener('click', function() {
      const activeTab = document.querySelector('.trips-tab-button.active');
      if (activeTab) {
        const tab = activeTab.getAttribute('data-tab');
        if (tab === 'bookings') {
          loadTripBookingsData();
        } else {
          loadTripsAdminData();
        }
      }
    });
  }
});

// =====================================================
// HOTELS TABS FUNCTIONALITY
// =====================================================
document.addEventListener('DOMContentLoaded', function() {
  const hotelsTabButtons = document.querySelectorAll('.hotels-tab-button');

  hotelsTabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tab = this.getAttribute('data-tab');

      hotelsTabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--admin-text-muted)';
      });
      this.classList.add('active');
      this.style.borderBottomColor = 'var(--admin-primary)';
      this.style.color = 'var(--admin-text)';

      document.getElementById('hotelsTabHotels').hidden = (tab !== 'hotels');
      document.getElementById('hotelsTabBookings').hidden = (tab !== 'bookings');

      if (tab === 'bookings') {
        loadHotelBookingsData();
      } else {
        loadHotelsAdminData();
      }
    });
  });

  const btnRefreshHotels = document.getElementById('btnRefreshHotels');
  if (btnRefreshHotels) {
    btnRefreshHotels.addEventListener('click', function() {
      const activeTab = document.querySelector('.hotels-tab-button.active');
      if (activeTab) {
        const tab = activeTab.getAttribute('data-tab');
        if (tab === 'bookings') {
          loadHotelBookingsData();
        } else {
          loadHotelsAdminData();
        }
      }
    });
  }
});

// =====================================================
// ALL ORDERS UNIFIED PANEL
// =====================================================

let allOrdersCache = [];
let filteredOrders = [];

/**
 * Load all orders from car_bookings, trip_bookings, and hotel_bookings
 */
async function loadAllOrders() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log('Loading all orders from all categories...');

    // Fetch all bookings in parallel
    const [carsResult, tripsResult, hotelsResult] = await Promise.all([
      client.from('car_bookings').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('trip_bookings').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('hotel_bookings').select('*').order('created_at', { ascending: false }).limit(200)
    ]);

    // Process car bookings
    const carBookings = (carsResult.data || []).map(booking => ({
      ...booking,
      category: 'cars',
      categoryLabel: 'Car Rental',
      categoryIcon: '🚗',
      categoryColor: '#3b82f6',
      displayName: `${booking.car_type || 'N/A'} - ${booking.pickup_location || 'N/A'}`,
      viewFunction: 'viewCarBookingDetails'
    }));

    // Process trip bookings
    const tripBookings = (tripsResult.data || []).map(booking => ({
      ...booking,
      category: 'trips',
      categoryLabel: 'Trip',
      categoryIcon: '🎯',
      categoryColor: '#10b981',
      displayName: booking.trip_slug || 'N/A',
      viewFunction: 'viewTripBookingDetails'
    }));

    // Process hotel bookings
    const hotelBookings = (hotelsResult.data || []).map(booking => ({
      ...booking,
      category: 'hotels',
      categoryLabel: 'Hotel',
      categoryIcon: '🏨',
      categoryColor: '#8b5cf6',
      displayName: booking.hotel_slug || 'N/A',
      viewFunction: 'viewHotelBookingDetails'
    }));

    // Combine all orders
    allOrdersCache = [...carBookings, ...tripBookings, ...hotelBookings];

    // Sort: pending/confirmed first, then by created_at descending
    allOrdersCache.sort((a, b) => {
      const statusPriority = {
        'pending': 1,
        'confirmed': 2,
        'completed': 3,
        'cancelled': 4
      };
      
      const aPriority = statusPriority[a.status] || 99;
      const bPriority = statusPriority[b.status] || 99;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Within same status, sort by created_at descending
      return new Date(b.created_at) - new Date(a.created_at);
    });

    console.log('All orders loaded:', allOrdersCache.length);

    // Update stats
    updateAllOrdersStats();

    // Apply filters and render
    applyOrderFilters();

    showToast(`Loaded ${allOrdersCache.length} orders successfully`, 'success');

  } catch (error) {
    console.error('Failed to load all orders:', error);
    showToast('Failed to load orders: ' + (error.message || 'Unknown error'), 'error');
    
    const tableBody = $('#allOrdersTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="table-loading" style="color: var(--admin-danger);">
            ❌ Error loading orders: ${escapeHtml(error.message || 'Unknown error')}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Update statistics for all orders panel
 */
function updateAllOrdersStats() {
  const carsPending = allOrdersCache.filter(o => o.category === 'cars' && o.status === 'pending').length;
  const tripsPending = allOrdersCache.filter(o => o.category === 'trips' && o.status === 'pending').length;
  const hotelsPending = allOrdersCache.filter(o => o.category === 'hotels' && o.status === 'pending').length;
  const totalOrders = allOrdersCache.length;

  const statCarsPendingEl = $('#statCarsPending');
  const statTripsPendingEl = $('#statTripsPending');
  const statHotelsPendingEl = $('#statHotelsPending');
  const statTotalOrdersEl = $('#statTotalOrders');

  if (statCarsPendingEl) statCarsPendingEl.textContent = carsPending;
  if (statTripsPendingEl) statTripsPendingEl.textContent = tripsPending;
  if (statHotelsPendingEl) statHotelsPendingEl.textContent = hotelsPending;
  if (statTotalOrdersEl) statTotalOrdersEl.textContent = totalOrders;
}

/**
 * Apply filters to orders
 */
function applyOrderFilters() {
  const categoryFilter = $('#orderCategoryFilter')?.value || 'all';
  const statusFilter = $('#orderStatusFilter')?.value || 'all';

  filteredOrders = allOrdersCache.filter(order => {
    const matchCategory = categoryFilter === 'all' || order.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchCategory && matchStatus;
  });

  renderAllOrdersTable();
}

/**
 * Render the unified orders table
 */
function renderAllOrdersTable() {
  const tableBody = $('#allOrdersTableBody');
  if (!tableBody) return;

  if (filteredOrders.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="table-loading">
          No orders found with current filters.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filteredOrders.map(order => {
    const statusClass = 
      order.status === 'confirmed' ? 'badge-success' :
      order.status === 'completed' ? 'badge-success' :
      order.status === 'pending' ? 'badge-warning' :
      order.status === 'cancelled' ? 'badge-danger' : 'badge';

    // Format dates based on category
    let dateInfo = '';
    if (order.category === 'cars') {
      const pickup = order.pickup_date ? new Date(order.pickup_date).toLocaleDateString('en-GB') : 'N/A';
      const dropoff = order.dropoff_date ? new Date(order.dropoff_date).toLocaleDateString('en-GB') : 'N/A';
      dateInfo = `${pickup} → ${dropoff}`;
    } else if (order.category === 'trips') {
      const tripDate = order.trip_date ? new Date(order.trip_date).toLocaleDateString('en-GB') : 'N/A';
      dateInfo = `Trip: ${tripDate}`;
    } else if (order.category === 'hotels') {
      const checkin = order.arrival_date ? new Date(order.arrival_date).toLocaleDateString('en-GB') : 'N/A';
      const checkout = order.departure_date ? new Date(order.departure_date).toLocaleDateString('en-GB') : 'N/A';
      dateInfo = `${checkin} → ${checkout}`;
    }

    const createdAt = order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : 'N/A';
    const createdTime = order.created_at ? new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

    return `
      <tr style="${order.status === 'completed' || order.status === 'cancelled' ? 'opacity: 0.6;' : ''}">
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 18px;">${order.categoryIcon}</span>
            <span style="font-size: 12px; font-weight: 600; color: ${order.categoryColor};">
              ${order.categoryLabel}
            </span>
          </div>
        </td>
        <td>
          <div style="font-weight: 600; font-size: 13px;">#${order.id.slice(0, 8).toUpperCase()}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
            ${escapeHtml(order.displayName)}
          </div>
        </td>
        <td>
          <div style="font-weight: 500; font-size: 13px;">${escapeHtml(order.customer_name || 'N/A')}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(order.customer_email || '')}</div>
          ${order.customer_phone ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(order.customer_phone)}</div>` : ''}
        </td>
        <td>
          <div style="font-size: 12px;">${dateInfo}</div>
          ${order.num_adults ? `<div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">👥 ${order.num_adults}${order.num_children ? '+' + order.num_children : ''}</div>` : ''}
        </td>
        <td>
          <span class="badge ${statusClass}">
            ${(order.status || 'unknown').toUpperCase()}
          </span>
        </td>
        <td style="font-weight: 600; color: var(--admin-success); font-size: 14px;">
          €${Number(order.total_price || order.quoted_price || order.final_price || 0).toFixed(2)}
        </td>
        <td>
          <div style="font-size: 12px;">${createdAt}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">${createdTime}</div>
        </td>
        <td>
          <button class="btn-secondary" onclick="${order.viewFunction}('${order.id}')" title="View details" style="font-size: 13px; padding: 6px 12px;">
            View
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Update footer
  const footer = $('#allOrdersFooter');
  if (footer) {
    footer.innerHTML = `
      Showing ${filteredOrders.length} of ${allOrdersCache.length} total orders
    `;
  }
}

// Initialize All Orders Panel
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing All Orders panel...');

  // Load orders when dashboard view becomes active
  const dashboardView = document.getElementById('viewDashboard');
  if (dashboardView && !dashboardView.hidden) {
    // Load immediately if dashboard is already visible
    setTimeout(() => loadAllOrders(), 1000);
  }

  // Refresh button
  const btnRefresh = document.getElementById('btnRefreshAllOrders');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadAllOrders);
  }

  // Category filter
  const categoryFilter = document.getElementById('orderCategoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyOrderFilters);
  }

  // Status filter
  const statusFilter = document.getElementById('orderStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', applyOrderFilters);
  }
});

// Export functions to window for onclick handlers
window.loadAllOrders = loadAllOrders;
