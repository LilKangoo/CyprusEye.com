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
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    // Store list globally for reordering helpers
    window.tripsAdminList = Array.isArray(trips) ? trips.slice() : [];

    // Stats
    const total = window.tripsAdminList?.length || 0;
    const published = (window.tripsAdminList || []).filter(t => t.is_published).length;
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
      tbody.innerHTML = '<tr><td colspan="7" class="table-loading">No trips found</td></tr>';
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
          <td>
            <button class="btn-secondary" onclick="moveTripOrder('${t.id}', 'up')">⬆️</button>
            <button class="btn-secondary" onclick="moveTripOrder('${t.id}', 'down')">⬇️</button>
          </td>
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
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="table-loading" style="color:var(--admin-danger)">Error: ${escapeHtml(e.message||'')}</td></tr>`;
  }
}

async function moveTripOrder(tripId, direction) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const list = Array.isArray(window.tripsAdminList) ? window.tripsAdminList : [];
    const index = list.findIndex(t => t.id === tripId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) {
      showToast('Cannot move further', 'info');
      return;
    }

    const current = list[index];
    const target = list[targetIndex];
    const currentOrder = typeof current.sort_order === 'number' ? current.sort_order : (index + 1);
    const targetOrder = typeof target.sort_order === 'number' ? target.sort_order : (targetIndex + 1);

    // Swap sort_order values between the two trips
    const { error: err1 } = await client
      .from('trips')
      .update({ sort_order: targetOrder })
      .eq('id', current.id);
    if (err1) throw err1;

    const { error: err2 } = await client
      .from('trips')
      .update({ sort_order: currentOrder })
      .eq('id', target.id);
    if (err2) throw err2;

    showToast('Trip order updated', 'success');
    await loadTripsAdminData();
  } catch (e) {
    console.error('Failed to update trip order:', e);
    showToast('Failed to update order: ' + (e.message || 'Unknown error'), 'error');
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
    // All trips use i18n (title and description are JSONB)
    const useI18n = true;
    const i18nContainer = document.getElementById('tripI18nFields');
    const legacyFields = document.getElementById('tripLegacyFields');
    
    if (useI18n && i18nContainer && legacyFields && window.renderI18nInput) {
      // Render i18n fields
      const titleContainer = document.getElementById('tripTitleI18n');
      const descContainer = document.getElementById('tripDescriptionI18n');
      
      if (titleContainer) {
        titleContainer.innerHTML = window.renderI18nInput({
          fieldName: 'title',
          label: 'Title',
          type: 'text',
          placeholder: 'Trip title',
          currentValues: trip?.title || {}
        });
      }
      
      if (descContainer) {
        descContainer.innerHTML = window.renderI18nInput({
          fieldName: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 4,
          placeholder: 'Trip description',
          currentValues: trip?.description || {}
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
    updateTripCoverPreview(trip.cover_image_url || '');
    
    // Render price fields based on pricing model
    renderEditTripPriceFields(trip.pricing_model, trip);
    
    // Setup pricing model change listener
    const pricingSelect = document.getElementById('editTripPricing');
    if (pricingSelect) {
      pricingSelect.onchange = (e) => renderEditTripPriceFields(e.target.value, trip);
    }
    
    // Setup cover URL input preview (live update as user types)
    const urlInput = document.getElementById('editTripCoverUrl');
    if (urlInput) {
      urlInput.oninput = () => {
        updateTripCoverPreview(urlInput.value);
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
    console.log('📝 Trip edit form submitted');
    
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
    
    // Extract i18n values (title and description are JSONB)
    if (window.extractI18nValues) {
      const titleI18n = window.extractI18nValues(fd, 'title');
      const descriptionI18n = window.extractI18nValues(fd, 'description');
      
      console.log('🔍 Extracted i18n values:', { titleI18n, descriptionI18n });
      
      // Validate i18n fields
      if (window.validateI18nField) {
        const titleError = window.validateI18nField(titleI18n, 'Title');
        if (titleError) {
          console.error('❌ Validation error:', titleError);
          throw new Error(titleError);
        }
        console.log('✅ Validation passed');
      }
      
      // Save directly to title and description (JSONB columns, like Hotels)
      if (titleI18n) payload.title = titleI18n;
      if (descriptionI18n) payload.description = descriptionI18n;
      
      console.log('💾 Payload title:', payload.title);
      console.log('💾 Payload description:', payload.description);
      
      // Clean up legacy fields from payload
      delete payload.title_pl;
      delete payload.title_en;
      delete payload.title_el;
      delete payload.title_he;
      delete payload.description_pl;
      delete payload.description_en;
      delete payload.description_el;
      delete payload.description_he;
    }
    
    // Handle is_published checkbox
    payload.is_published = form.querySelector('#editTripPublished').checked;
    
    // Update timestamp
    payload.updated_at = new Date().toISOString();
    
    const tripId = document.getElementById('editTripId').value;
    
    console.log('🚀 Updating trip in database...');
    console.log('   Trip ID:', tripId);
    console.log('   Payload:', payload);
    
    // Update via Supabase client
    const { error } = await client
      .from('trips')
      .update(payload)
      .eq('id', tripId);
    
    if (error) {
      console.error('❌ Trip update error:', error);
      throw error;
    }
    
    console.log('✅ Trip updated successfully');
    showToast('Trip updated successfully', 'success');
    document.getElementById('editTripModal').hidden = true;
    await loadTripsAdminData();
    
  } catch (err) {
    console.error('❌ Failed to update trip:', err);
    showToast(err.message || 'Failed to update trip', 'error');
  }
}

// Trip cover image upload
async function handleTripCoverUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  
  // Validate file
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image must be smaller than 5MB', 'error');
    return;
  }
  
  const uploadBtn = input.previousElementSibling?.previousElementSibling?.querySelector?.('.btn-upload-image') 
    || document.querySelector('.btn-upload-image');
  
  try {
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '⏳ Uploading...';
    }
    
    const client = ensureSupabase();
    if (!client) throw new Error('Database not available');
    
    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `trips/cover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    
    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from('images')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = client.storage
      .from('images')
      .getPublicUrl(filename);
    
    // Set URL in input field
    const urlInput = document.getElementById('editTripCoverUrl');
    if (urlInput) {
      urlInput.value = publicUrl;
      // Trigger preview update
      updateTripCoverPreview(publicUrl);
    }
    
    showToast('Image uploaded successfully', 'success');
    
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Failed to upload image: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '📤 Upload';
    }
    input.value = ''; // Reset file input
  }
}

function updateTripCoverPreview(url) {
  const previewWrap = document.getElementById('editTripCoverPreview');
  const previewImg = previewWrap?.querySelector('img');
  
  if (!previewWrap || !previewImg) return;
  
  if (url && url.trim()) {
    previewImg.src = url;
    previewWrap.style.display = 'block';
  } else {
    previewWrap.style.display = 'none';
  }
}

function removeTripCoverImage() {
  const urlInput = document.getElementById('editTripCoverUrl');
  if (urlInput) {
    urlInput.value = '';
  }
  updateTripCoverPreview('');
}

// expose trip helpers for inline handlers
window.toggleTripPublish = toggleTripPublish;
window.editTrip = editTrip;
window.moveTripOrder = moveTripOrder;
window.handleTripCoverUpload = handleTripCoverUpload;
window.removeTripCoverImage = removeTripCoverImage;
window.updateTripCoverPreview = updateTripCoverPreview;

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
      
      // Render i18n fields for title and description
      const titleContainer = document.getElementById('newTripTitleI18n');
      const descContainer = document.getElementById('newTripDescriptionI18n');
      
      if (titleContainer && window.renderI18nInput) {
        titleContainer.innerHTML = window.renderI18nInput({
          fieldName: 'title',
          label: 'Title',
          type: 'text',
          placeholder: 'Trip title',
          currentValues: {}
        });
      }
      
      if (descContainer && window.renderI18nInput) {
        descContainer.innerHTML = window.renderI18nInput({
          fieldName: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 3,
          placeholder: 'Trip description',
          currentValues: {}
        });
      }
      
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
          
          console.log('📝 Creating new trip...');
          
          // Normalize types
          ['price_base','price_per_person','price_extra_person','included_people','min_hours'].forEach(k=>{
            if (payload[k] === '' || payload[k] == null) delete payload[k];
            else payload[k] = Number(payload[k]);
          });
          
          // Extract i18n values (title and description are JSONB)
          if (window.extractI18nValues) {
            const titleI18n = window.extractI18nValues(fd, 'title');
            const descriptionI18n = window.extractI18nValues(fd, 'description');
            
            console.log('🔍 Extracted i18n values:', { titleI18n, descriptionI18n });
            
            // Validate i18n fields
            if (window.validateI18nField) {
              const titleError = window.validateI18nField(titleI18n, 'Title');
              if (titleError) {
                console.error('❌ Validation error:', titleError);
                throw new Error(titleError);
              }
              console.log('✅ Validation passed');
            }
            
            // Save directly to title and description (JSONB columns, like Hotels)
            if (titleI18n) payload.title = titleI18n;
            if (descriptionI18n) payload.description = descriptionI18n;
            
            // Clean up legacy fields from payload
            delete payload.title_pl;
            delete payload.title_en;
            delete payload.title_el;
            delete payload.title_he;
            delete payload.description_pl;
            delete payload.description_en;
            delete payload.description_el;
            delete payload.description_he;
            
            // Auto-generate slug from Polish title
            payload.slug = slugifyTitle(titleI18n?.pl || 'trip');
          } else {
            throw new Error('i18n functions not available');
          }

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

          console.log('🚀 Inserting trip into database...');
          console.log('   Payload:', payload);

          // Insert directly via Supabase client (like Cars does)
          const { data, error } = await client
            .from('trips')
            .insert(payload)
            .select('*')
            .single();

          if (error) {
            console.error('❌ Trip insert error:', error);
            throw error;
          }

          console.log('✅ Trip created successfully:', data);
          showToast('Trip created successfully', 'success');
          document.getElementById('newTripModal').hidden = true;
          await loadTripsAdminData();
          
        } catch (err) {
          console.error('❌ Create trip failed:', err);
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

// =====================================================
// HOTEL CITIES MANAGEMENT
// =====================================================
let hotelCitiesCache = [];

async function loadHotelCities() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data, error } = await client
      .from('hotel_cities')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) {
      console.warn('Failed to load hotel cities from DB, using fallback:', error);
      // Fallback to hardcoded cities
      hotelCitiesCache = [
        { name: 'Larnaca' },
        { name: 'Paphos' },
        { name: 'Limassol' },
        { name: 'Ayia Napa' },
        { name: 'Nicosia' }
      ];
    } else {
      hotelCitiesCache = data || [];
      console.log('✅ Hotel cities loaded:', hotelCitiesCache.length);
    }
    
    populateHotelCitySelects();
  } catch (e) {
    console.error('Failed to load hotel cities:', e);
    hotelCitiesCache = [
      { name: 'Larnaca' },
      { name: 'Paphos' },
      { name: 'Limassol' },
      { name: 'Ayia Napa' },
      { name: 'Nicosia' }
    ];
    populateHotelCitySelects();
  }
}

function populateHotelCitySelects(selectedValue = null) {
  const selectIds = ['newHotelCity', 'editHotelCity'];
  
  selectIds.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    
    const currentValue = selectedValue || select.value;
    
    select.innerHTML = hotelCitiesCache.map(city => 
      `<option value="${escapeHtml(city.name)}">${escapeHtml(city.name)}</option>`
    ).join('');
    
    // Restore selected value if exists
    if (currentValue) {
      const option = Array.from(select.options).find(o => o.value === currentValue);
      if (option) {
        select.value = currentValue;
      }
    }
  });
}

function openAddCityModal() {
  const modal = document.getElementById('addCityModal');
  const form = document.getElementById('addCityForm');
  
  if (!modal || !form) {
    // Fallback to prompt if modal doesn't exist
    const cityName = prompt('Enter new city name:');
    if (cityName && cityName.trim()) {
      addNewHotelCity(cityName.trim());
    }
    return;
  }
  
  form.reset();
  modal.hidden = false;
  setTimeout(() => document.getElementById('newCityName')?.focus(), 100);
}

async function addNewHotelCity(name, namePl = null) {
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database not available');
    
    // Check if city already exists
    const exists = hotelCitiesCache.find(c => 
      c.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      showToast(`City "${name}" already exists`, 'warning');
      return;
    }
    
    const payload = {
      name: name.trim(),
      name_en: name.trim(),
      name_pl: namePl?.trim() || name.trim(),
      display_order: hotelCitiesCache.length + 1,
      is_active: true
    };
    
    const { error } = await client
      .from('hotel_cities')
      .insert(payload);
    
    if (error) throw error;
    
    showToast(`City "${name}" added successfully`, 'success');
    
    // Reload cities and update selects
    await loadHotelCities();
    
    // Select the new city in the active form
    populateHotelCitySelects(name);
    
    // Close modal if open
    const modal = document.getElementById('addCityModal');
    if (modal) modal.hidden = true;
    
  } catch (e) {
    console.error('Failed to add city:', e);
    showToast('Failed to add city: ' + (e.message || 'Unknown error'), 'error');
  }
}

// Form handler for Add City modal
function setupAddCityForm() {
  const form = document.getElementById('addCityForm');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('newCityName')?.value?.trim();
    const namePl = document.getElementById('newCityNamePl')?.value?.trim();
    
    if (!name) {
      showToast('City name is required', 'error');
      return;
    }
    
    await addNewHotelCity(name, namePl || null);
  });
}

// Export functions globally
window.openAddCityModal = openAddCityModal;
window.addNewHotelCity = addNewHotelCity;

// =====================================================
// HOTEL AMENITIES MANAGEMENT
// =====================================================
let hotelAmenitiesCache = [];

const AMENITY_CATEGORY_LABELS = {
  general: { label: 'General', icon: '🏨' },
  wellness: { label: 'Wellness & Spa', icon: '💆' },
  food: { label: 'Food & Drink', icon: '🍽️' },
  room: { label: 'Room Features', icon: '🛏️' },
  outdoor: { label: 'Outdoor', icon: '🌳' },
  services: { label: 'Services', icon: '🛎️' }
};

async function loadHotelAmenities() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data, error } = await client
      .from('hotel_amenities')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) {
      console.warn('Failed to load hotel amenities:', error);
      hotelAmenitiesCache = [];
    } else {
      hotelAmenitiesCache = data || [];
      console.log('✅ Hotel amenities loaded:', hotelAmenitiesCache.length);
    }
  } catch (e) {
    console.error('Failed to load hotel amenities:', e);
    hotelAmenitiesCache = [];
  }
}

function renderAmenitiesCheckboxes(containerId, selectedCodes = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (!hotelAmenitiesCache.length) {
    container.innerHTML = '<div class="table-loading">No amenities available</div>';
    return;
  }
  
  // Group by category
  const categories = {};
  hotelAmenitiesCache.forEach(a => {
    if (!categories[a.category]) categories[a.category] = [];
    categories[a.category].push(a);
  });
  
  // Order categories
  const categoryOrder = ['general', 'wellness', 'food', 'room', 'outdoor', 'services'];
  
  let html = '';
  categoryOrder.forEach(cat => {
    const items = categories[cat];
    if (!items || !items.length) return;
    
    const catInfo = AMENITY_CATEGORY_LABELS[cat] || { label: cat, icon: '📍' };
    
    html += `
      <div class="amenity-category">
        <div class="amenity-category-header">
          <span class="category-icon">${catInfo.icon}</span>
          ${catInfo.label}
        </div>
        <div class="amenity-items">
          ${items.map(a => `
            <label class="amenity-checkbox">
              <input type="checkbox" name="amenities" value="${escapeHtml(a.code)}" 
                ${selectedCodes.includes(a.code) ? 'checked' : ''}>
              <span>${a.icon} ${escapeHtml(a.name_en)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function collectSelectedAmenities(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const checked = container.querySelectorAll('input[name="amenities"]:checked');
  return Array.from(checked).map(cb => cb.value);
}

function openAddAmenityModal() {
  const modal = document.getElementById('addAmenityModal');
  const form = document.getElementById('addAmenityForm');
  if (!modal || !form) return;
  
  form.reset();
  modal.hidden = false;
  setTimeout(() => document.getElementById('newAmenityCode')?.focus(), 100);
}

async function addNewAmenity(data) {
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database not available');
    
    // Check if code already exists
    const exists = hotelAmenitiesCache.find(a => a.code === data.code);
    if (exists) {
      showToast(`Amenity with code "${data.code}" already exists`, 'warning');
      return false;
    }
    
    const payload = {
      code: data.code.toLowerCase().replace(/[^a-z_]/g, ''),
      category: data.category,
      icon: data.icon,
      name_en: data.name_en,
      name_pl: data.name_pl,
      display_order: hotelAmenitiesCache.length + 1,
      is_popular: data.is_popular || false,
      is_active: true
    };
    
    const { error } = await client
      .from('hotel_amenities')
      .insert(payload);
    
    if (error) throw error;
    
    showToast(`Amenity "${data.name_en}" added successfully`, 'success');
    
    // Reload amenities
    await loadHotelAmenities();
    
    // Re-render checkboxes in both forms
    renderAmenitiesCheckboxes('newHotelAmenities', collectSelectedAmenities('newHotelAmenities'));
    renderAmenitiesCheckboxes('editHotelAmenities', collectSelectedAmenities('editHotelAmenities'));
    
    return true;
  } catch (e) {
    console.error('Failed to add amenity:', e);
    showToast('Failed to add amenity: ' + (e.message || 'Unknown error'), 'error');
    return false;
  }
}

function setupAddAmenityForm() {
  const form = document.getElementById('addAmenityForm');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
      code: document.getElementById('newAmenityCode')?.value?.trim(),
      category: document.getElementById('newAmenityCategory')?.value,
      icon: document.getElementById('newAmenityIcon')?.value?.trim(),
      name_en: document.getElementById('newAmenityNameEn')?.value?.trim(),
      name_pl: document.getElementById('newAmenityNamePl')?.value?.trim(),
      is_popular: document.getElementById('newAmenityPopular')?.checked || false
    };
    
    if (!data.code || !data.name_en || !data.name_pl || !data.icon) {
      showToast('All fields are required', 'error');
      return;
    }
    
    const success = await addNewAmenity(data);
    if (success) {
      document.getElementById('addAmenityModal').hidden = true;
    }
  });
}

// Export amenity functions globally
window.openAddAmenityModal = openAddAmenityModal;
window.addNewAmenity = addNewAmenity;

// =====================================================
// HOTEL PHOTO MANAGER
// =====================================================

// Local state for photo management
let editHotelPhotosState = {
  photos: [],
  coverUrl: '',
  pendingUploads: []
};

let newHotelPhotosState = {
  photos: [],
  coverUrl: '',
  pendingUploads: []
};

function getPhotoState(formType) {
  return formType === 'edit' ? editHotelPhotosState : newHotelPhotosState;
}

function renderPhotoManager(formType) {
  const state = getPhotoState(formType);
  const containerId = formType === 'edit' ? 'editHotelPhotosManager' : 'newHotelPhotosManager';
  const countId = formType === 'edit' ? 'editHotelPhotosCount' : 'newHotelPhotosCount';
  const coverImgId = formType === 'edit' ? 'editHotelCoverPreviewImg' : 'newHotelCoverPreviewImg';
  const coverUrlId = formType === 'edit' ? 'editHotelCoverUrl' : 'newHotelCoverUrl';
  
  const container = document.getElementById(containerId);
  const countEl = document.getElementById(countId);
  const coverImg = document.getElementById(coverImgId);
  const coverUrlInput = document.getElementById(coverUrlId);
  
  if (!container) return;
  
  // Update count
  if (countEl) countEl.textContent = state.photos.length;
  
  // Update cover preview
  if (coverImg) {
    coverImg.src = state.coverUrl || '';
    coverImg.style.display = state.coverUrl ? 'block' : 'none';
  }
  if (coverUrlInput && state.coverUrl) {
    coverUrlInput.value = state.coverUrl;
  }
  
  // Render photo grid
  if (!state.photos.length) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = state.photos.map((url, index) => {
    const isCover = url === state.coverUrl;
    return `
      <div class="photo-item ${isCover ? 'is-cover' : ''}" data-index="${index}">
        <img src="${escapeHtml(url)}" alt="Photo ${index + 1}" loading="lazy">
        <div class="photo-actions">
          <button type="button" onclick="moveHotelPhoto('${formType}', ${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Move left">◀</button>
          <button type="button" onclick="moveHotelPhoto('${formType}', ${index}, 1)" ${index === state.photos.length - 1 ? 'disabled' : ''} title="Move right">▶</button>
          <button type="button" class="btn-cover" onclick="setAsCoverImage('${formType}', ${index})" title="Set as cover">⭐</button>
          <button type="button" class="btn-delete" onclick="deleteHotelPhoto('${formType}', ${index})" title="Delete">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function moveHotelPhoto(formType, index, direction) {
  const state = getPhotoState(formType);
  const newIndex = index + direction;
  
  if (newIndex < 0 || newIndex >= state.photos.length) return;
  
  // Swap
  const temp = state.photos[index];
  state.photos[index] = state.photos[newIndex];
  state.photos[newIndex] = temp;
  
  renderPhotoManager(formType);
}

function deleteHotelPhoto(formType, index) {
  const state = getPhotoState(formType);
  const deletedUrl = state.photos[index];
  
  state.photos.splice(index, 1);
  
  // If deleted photo was cover, reset cover
  if (deletedUrl === state.coverUrl) {
    state.coverUrl = state.photos[0] || '';
  }
  
  renderPhotoManager(formType);
}

function setAsCoverImage(formType, index) {
  const state = getPhotoState(formType);
  state.coverUrl = state.photos[index];
  
  // Also update the URL input
  const coverUrlId = formType === 'edit' ? 'editHotelCoverUrl' : 'newHotelCoverUrl';
  const coverUrlInput = document.getElementById(coverUrlId);
  if (coverUrlInput) coverUrlInput.value = state.coverUrl;
  
  renderPhotoManager(formType);
  showToast('Cover image updated', 'success');
}

function removeCoverImage(formType) {
  const state = getPhotoState(formType);
  state.coverUrl = '';
  
  const coverUrlId = formType === 'edit' ? 'editHotelCoverUrl' : 'newHotelCoverUrl';
  const coverUrlInput = document.getElementById(coverUrlId);
  if (coverUrlInput) coverUrlInput.value = '';
  
  renderPhotoManager(formType);
}

async function handleCoverFileUpload(formType, file, hotelSlug) {
  if (!file || !file.type.startsWith('image/')) return null;
  
  const state = getPhotoState(formType);
  
  try {
    const client = ensureSupabase();
    const compressed = await compressToWebp(file, 1920, 1080, 0.82);
    const path = `hotels/${hotelSlug}/cover-${Date.now()}.webp`;
    
    const { error } = await client.storage.from('poi-photos').upload(path, compressed, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/webp'
    });
    
    if (error) throw error;
    
    const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
    const url = pub?.publicUrl || '';
    
    state.coverUrl = url;
    renderPhotoManager(formType);
    
    return url;
  } catch (e) {
    console.error('Cover upload failed:', e);
    showToast('Failed to upload cover image', 'error');
    return null;
  }
}

async function handlePhotosUpload(formType, files, hotelSlug) {
  const state = getPhotoState(formType);
  const maxPhotos = 10;
  const available = maxPhotos - state.photos.length;
  
  if (available <= 0) {
    showToast('Maximum 10 photos allowed', 'warning');
    return;
  }
  
  const filesToUpload = Array.from(files).slice(0, available);
  
  try {
    const client = ensureSupabase();
    
    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) continue;
      
      const compressed = await compressToWebp(file, 1920, 1080, 0.82);
      const path = `hotels/${hotelSlug}/photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.webp`;
      
      const { error } = await client.storage.from('poi-photos').upload(path, compressed, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp'
      });
      
      if (error) {
        console.error('Photo upload failed:', error);
        continue;
      }
      
      const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
      const url = pub?.publicUrl || '';
      
      if (url) {
        state.photos.push(url);
        
        // Set as cover if no cover yet
        if (!state.coverUrl) {
          state.coverUrl = url;
        }
      }
    }
    
    renderPhotoManager(formType);
    showToast(`${filesToUpload.length} photo(s) uploaded`, 'success');
    
  } catch (e) {
    console.error('Photos upload failed:', e);
    showToast('Failed to upload photos', 'error');
  }
}

function setupPhotoManagerBindings(formType, hotelSlug) {
  const coverFileId = formType === 'edit' ? 'editHotelCoverFile' : 'newHotelCoverFile';
  const photosAddId = formType === 'edit' ? 'editHotelPhotosAdd' : 'newHotelPhotosAdd';
  const coverUrlId = formType === 'edit' ? 'editHotelCoverUrl' : 'newHotelCoverUrl';
  
  const coverFileInput = document.getElementById(coverFileId);
  const photosAddInput = document.getElementById(photosAddId);
  const coverUrlInput = document.getElementById(coverUrlId);
  
  // Cover file upload
  if (coverFileInput) {
    coverFileInput.onchange = async () => {
      const file = coverFileInput.files?.[0];
      if (file) {
        showToast('Uploading cover...', 'info');
        await handleCoverFileUpload(formType, file, hotelSlug);
      }
      coverFileInput.value = '';
    };
  }
  
  // Photos upload
  if (photosAddInput) {
    photosAddInput.onchange = async () => {
      const files = photosAddInput.files;
      if (files?.length) {
        showToast('Uploading photos...', 'info');
        await handlePhotosUpload(formType, files, hotelSlug);
      }
      photosAddInput.value = '';
    };
  }
  
  // Cover URL input
  if (coverUrlInput) {
    coverUrlInput.oninput = () => {
      const state = getPhotoState(formType);
      state.coverUrl = coverUrlInput.value.trim();
      renderPhotoManager(formType);
    };
  }
}

// Export photo manager functions
window.moveHotelPhoto = moveHotelPhoto;
window.deleteHotelPhoto = deleteHotelPhoto;
window.setAsCoverImage = setAsCoverImage;
window.removeCoverImage = removeCoverImage;

async function loadHotelsAdminData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    // Load cities and amenities first
    await loadHotelCities();
    await loadHotelAmenities();
    setupAddCityForm();
    setupAddAmenityForm();

    const { data: hotels, error } = await client
      .from('hotels')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    // Store list globally for reordering helpers
    window.hotelsAdminList = Array.isArray(hotels) ? hotels.slice() : [];

    const total = window.hotelsAdminList?.length || 0;
    const published = (window.hotelsAdminList || []).filter(h => h.is_published).length;
    const statTotal = document.getElementById('hotelsStatTotal');
    const statPub = document.getElementById('hotelsStatPublished');
    const sub = document.getElementById('hotelsStatSubtitle');
    if (statTotal) statTotal.textContent = total;
    if (statPub) statPub.textContent = published;
    if (sub) sub.textContent = total ? `${published} published` : 'No hotels yet';

    const tbody = document.getElementById('hotelsTableBody');
    if (!tbody) return;
    if (!window.hotelsAdminList || window.hotelsAdminList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-loading">No hotels found</td></tr>';
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

    tbody.innerHTML = window.hotelsAdminList.map((h, index) => {
      const title = (h.title && (h.title.pl || h.title.en)) || h.slug || h.id;
      const updated = h.updated_at ? new Date(h.updated_at).toLocaleString('en-GB') : '-';
      const priceSummary = formatHotelPriceSummary(h);
      const sortOrder = typeof h.sort_order === 'number' ? h.sort_order : (index + 1);
      return `
        <tr>
          <td>
            <div style="font-weight:600">${escapeHtml(title)}</div>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
              <span style="font-size:11px;color:var(--admin-text-muted);">#${index + 1}</span>
              <div style="display:flex;flex-direction:column;gap:2px;">
                <button type="button" title="Move up" onclick="moveHotelOrder('${h.id}','up')" style="border:1px solid var(--admin-border);background:var(--admin-bg-secondary);color:var(--admin-text);border-radius:4px;padding:0 4px;font-size:10px;line-height:14px;">▲</button>
                <button type="button" title="Move down" onclick="moveHotelOrder('${h.id}','down')" style="border:1px solid var(--admin-border);background:var(--admin-bg-secondary);color:var(--admin-text);border-radius:4px;padding:0 4px;font-size:10px;line-height:14px;">▼</button>
              </div>
              <span style="font-size:10px;color:var(--admin-text-muted);">${sortOrder}</span>
            </div>
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
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="table-loading" style="color:var(--admin-danger)">Error: ${escapeHtml(e.message||'')}</td></tr>`;
  }
}

async function moveHotelOrder(hotelId, direction) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const list = Array.isArray(window.hotelsAdminList) ? window.hotelsAdminList : [];
    const index = list.findIndex(h => h.id === hotelId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) {
      showToast('Cannot move further', 'info');
      return;
    }

    const current = list[index];
    const target = list[targetIndex];
    const currentOrder = typeof current.sort_order === 'number' ? current.sort_order : (index + 1);
    const targetOrder = typeof target.sort_order === 'number' ? target.sort_order : (targetIndex + 1);

    const { error: err1 } = await client
      .from('hotels')
      .update({ sort_order: targetOrder })
      .eq('id', current.id);
    if (err1) throw err1;

    const { error: err2 } = await client
      .from('hotels')
      .update({ sort_order: currentOrder })
      .eq('id', target.id);
    if (err2) throw err2;

    showToast('Hotel order updated', 'success');
    await loadHotelsAdminData();
  } catch (e) {
    console.error('Failed to update hotel order:', e);
    showToast('Failed to update order: ' + (e.message || 'Unknown error'), 'error');
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
    
    // Ensure cities are loaded and set the value
    if (hotelCitiesCache.length === 0) {
      await loadHotelCities();
    }
    const citySelect = document.getElementById('editHotelCity');
    if (citySelect && hotel.city) {
      // Ensure city exists in options, if not add it temporarily
      const cityExists = Array.from(citySelect.options).find(o => o.value === hotel.city);
      if (!cityExists) {
        const opt = document.createElement('option');
        opt.value = hotel.city;
        opt.textContent = hotel.city;
        citySelect.appendChild(opt);
      }
      citySelect.value = hotel.city;
    }
    
    // Render i18n inputs for Title
    const titleContainer = document.getElementById('editHotelTitleI18n');
    if (titleContainer && typeof window.renderI18nInput === 'function') {
      titleContainer.innerHTML = window.renderI18nInput({
        fieldName: 'title',
        label: 'Title',
        type: 'text',
        currentValues: hotel.title || {},
        placeholder: 'Hotel title'
      });
    }
    
    // Render i18n inputs for Description
    const descContainer = document.getElementById('editHotelDescriptionI18n');
    if (descContainer && typeof window.renderI18nInput === 'function') {
      descContainer.innerHTML = window.renderI18nInput({
        fieldName: 'description',
        label: 'Description',
        type: 'textarea',
        currentValues: hotel.description || {},
        placeholder: 'Hotel description',
        rows: 4
      });
    }
    
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

    // Initialize photo manager state
    editHotelPhotosState.photos = Array.isArray(hotel.photos) ? hotel.photos.slice() : [];
    editHotelPhotosState.coverUrl = hotel.cover_image_url || '';
    
    // Setup bindings and render
    setupPhotoManagerBindings('edit', hotel.slug);
    renderPhotoManager('edit');

    // Render amenities checkboxes with currently selected values
    const hotelAmenities = Array.isArray(hotel.amenities) ? hotel.amenities : [];
    renderAmenitiesCheckboxes('editHotelAmenities', hotelAmenities);

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
  console.log('📝 Hotel edit form submitted');
  
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    const form = event.target;
    const fd = new FormData(form);
    
    console.log('📋 FormData entries:');
    for (let [key, value] of fd.entries()) {
      if (key.includes('title') || key.includes('description')) {
        console.log(`  ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      }
    }
    
    const payload = Object.fromEntries(fd.entries());

    // Extract i18n values
    console.log('🔧 Checking i18n functions:', {
      extractI18nValues: typeof window.extractI18nValues,
      validateI18nField: typeof window.validateI18nField
    });
    
    const titleI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'title') : null;
    const descriptionI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'description') : null;
    
    console.log('🔍 Hotel i18n extracted:', { titleI18n, descriptionI18n });
    
    // Validate required fields (PL and EN)
    if (window.validateI18nField) {
      const titleError = window.validateI18nField(titleI18n, 'Title');
      if (titleError) {
        console.error('❌ Validation error:', titleError);
        throw new Error(titleError);
      }
    }
    
    // Assign i18n fields
    if (titleI18n) payload.title = titleI18n;
    if (descriptionI18n) payload.description = descriptionI18n;
    
    // Clean up legacy fields from payload
    delete payload.title_pl;
    delete payload.title_en;
    delete payload.title_el;
    delete payload.title_he;
    delete payload.description_pl;
    delete payload.description_en;
    delete payload.description_el;
    delete payload.description_he;

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

    // Collect amenities
    payload.amenities = collectSelectedAmenities('editHotelAmenities');

    // Get photos and cover from state
    payload.photos = editHotelPhotosState.photos.slice(0, 10);
    payload.cover_image_url = editHotelPhotosState.coverUrl || null;

    console.log('💾 Updating hotel with payload:', {
      hotelId,
      title: payload.title,
      description: payload.description,
      slug: payload.slug
    });

    const { error } = await client
      .from('hotels')
      .update(payload)
      .eq('id', hotelId);

    if (error) {
      console.error('❌ Hotel update error:', error);
      throw error;
    }
    
    console.log('✅ Hotel updated successfully');

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
      
      // Render i18n inputs for Title
      const newTitleContainer = document.getElementById('newHotelTitleI18n');
      if (newTitleContainer && typeof window.renderI18nInput === 'function') {
        newTitleContainer.innerHTML = window.renderI18nInput({
          fieldName: 'title',
          label: 'Title',
          type: 'text',
          currentValues: {},
          placeholder: 'Hotel title'
        });
      }
      
      // Render i18n inputs for Description
      const newDescContainer = document.getElementById('newHotelDescriptionI18n');
      if (newDescContainer && typeof window.renderI18nInput === 'function') {
        newDescContainer.innerHTML = window.renderI18nInput({
          fieldName: 'description',
          label: 'Description',
          type: 'textarea',
          currentValues: {},
          placeholder: 'Hotel description',
          rows: 3
        });
      }

      // Initialize photo manager state for new hotel
      newHotelPhotosState.photos = [];
      newHotelPhotosState.coverUrl = '';
      
      // Note: bindings will be set up after slug is generated in form submit
      // For now, just render empty state
      renderPhotoManager('new');

      // Pricing tiers editor init
      renderPricingTiers('newHotelPricingTiersBody', []);
      const btnAddNewTier = document.getElementById('btnAddNewHotelTier');
      if (btnAddNewTier && !btnAddNewTier.dataset.bound) {
        btnAddNewTier.addEventListener('click', () => addPricingTierRow('newHotelPricingTiersBody'));
        btnAddNewTier.dataset.bound = '1';
      }
      
      // Setup temporary slug for uploads (will be updated)
      const tempSlug = `new-hotel-${Date.now()}`;
      setupPhotoManagerBindings('new', tempSlug);

      form.onsubmit = async (ev) => {
        ev.preventDefault();
        try {
          const client = ensureSupabase();
          if (!client) throw new Error('Database connection not available');

          const fd = new FormData(form);
          const payload = Object.fromEntries(fd.entries());

          // Extract i18n values
          const titleI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'title') : null;
          const descriptionI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'description') : null;
          
          console.log('🔍 New Hotel i18n extracted:', { titleI18n, descriptionI18n });
          
          // Validate required fields (PL and EN)
          if (window.validateI18nField) {
            const titleError = window.validateI18nField(titleI18n, 'Title');
            if (titleError) {
              console.error('❌ Validation error:', titleError);
              throw new Error(titleError);
            }
          }
          
          // Assign i18n fields
          if (titleI18n) payload.title = titleI18n;
          if (descriptionI18n) payload.description = descriptionI18n;
          
          // Clean up legacy fields from payload
          delete payload.title_pl;
          delete payload.title_en;
          delete payload.title_el;
          delete payload.title_he;
          delete payload.description_pl;
          delete payload.description_en;
          delete payload.description_el;
          delete payload.description_he;
          
          // Generate slug from Polish title (fallback to English)
          const slugSource = titleI18n?.pl || titleI18n?.en || `hotel-${Date.now()}`;
          payload.slug = slugifyHotelTitle(slugSource);

          // Get photos and cover from state (already uploaded via photo manager)
          payload.photos = newHotelPhotosState.photos.slice(0, 10);
          payload.cover_image_url = newHotelPhotosState.coverUrl || null;

          // pricing tiers
          payload.pricing_tiers = collectPricingTiers('newHotelPricingTiersBody');

          // max persons
          const maxPNew = document.getElementById('newHotelMaxPersons');
          if (maxPNew && maxPNew.value) {
            const v = Number(maxPNew.value);
            payload.max_persons = Number.isFinite(v) && v > 0 ? v : null;
          }

          // Collect amenities
          payload.amenities = collectSelectedAmenities('newHotelAmenities');

          const now = new Date().toISOString();
          payload.created_at = now;
          payload.updated_at = now;
          payload.is_published = false;

          console.log('💾 Creating new hotel with payload:', {
            slug: payload.slug,
            title: payload.title,
            description: payload.description
          });

          const { data, error } = await client
            .from('hotels')
            .insert(payload)
            .select('*')
            .single();

          if (error) {
            console.error('❌ Hotel insert error:', error);
            throw error;
          }
          
          console.log('✅ Hotel created successfully:', data);

          showToast('Hotel created successfully', 'success');
          document.getElementById('newHotelModal').hidden = true;
          await loadHotelsAdminData();
        } catch (err) {
          console.error('Create hotel failed:', err);
          showToast(err.message || 'Failed to create hotel', 'error');
        }
      };
    }

    // Render amenities checkboxes
    renderAmenitiesCheckboxes('newHotelAmenities', []);

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
            ${adminState && adminState.isAdmin ? `
            <button class="btn-danger" onclick="deleteHotelBooking('${booking.id}')" title="Delete booking" style="margin-left: 8px;">
              Delete
            </button>
            ` : ''}
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
    const canDelete = !!(adminState && adminState.isAdmin);
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
  const typed = prompt('Type DELETE to confirm deletion:');
  if (typed !== 'DELETE') {
    showToast('Deletion cancelled', 'info');
    return;
  }
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    try {
      await client
        .from('partner_service_fulfillments')
        .delete()
        .eq('resource_type', 'hotels')
        .eq('booking_id', bookingId);
    } catch (_e) {
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
window.moveHotelOrder = moveHotelOrder;
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
    case 'referrals':
      loadReferralSettings();
      loadReferralsData();
      break;
    case 'recommendations':
      loadRecommendationsData();
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

async function handleSendPasswordReset(userId) {
  try {
    const result = await apiRequest(`/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reset' }),
    });

    if (result && result.link) {
      try {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(result.link);
          showToast('Password reset link generated and copied to clipboard', 'success');
          return;
        }
      } catch (_) {
        // Fallback to normal toast below
      }
      showToast('Password reset link generated. Copy it from the console/network response.', 'success');
    } else {
      showToast('Password reset link generated', 'success');
    }
  } catch (e) {
    showToast('Failed to generate reset link: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function handleSendMagicLink(userId) {
  try {
    const result = await apiRequest(`/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ action: 'magic_link' }),
    });

    if (result && result.link) {
      try {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(result.link);
          showToast('Magic link generated and copied to clipboard', 'success');
          return;
        }
      } catch (_) {
        // Fallback to normal toast below
      }
      showToast('Magic link generated. Copy it from the console/network response.', 'success');
    } else {
      showToast('Magic link generated', 'success');
    }
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
    await apiRequest(`/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ action: 'set_temporary', temp_password: pwd }),
    });
    showToast('Temporary password set', 'success');
  } catch (e) {
    showToast('Failed to set temporary password: ' + (e.message || 'Unknown error'), 'error');
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
      .select('id,xp,is_active,sort_order,category,title,description,title_i18n,description_i18n,verification_type,unlock_code,latitude,longitude,location_radius,location_name_i18n,recommendation_id')
      .eq('category', 'quest')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    adminState.quests = Array.isArray(data) ? data : [];
    const tbody = $('#questsTableBody');
    if (!tbody) return;
    if (adminState.quests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No quests</td></tr>';
      return;
    }
    tbody.innerHTML = adminState.quests.map(q => {
      const verificationBadge = q.verification_type && q.verification_type !== 'none' 
        ? `<span style="font-size: 0.8em; padding: 2px 6px; border-radius: 4px; background: ${q.verification_type === 'code' ? '#10b981' : q.verification_type === 'location' ? '#3b82f6' : '#8b5cf6'}; color: white;">${q.verification_type === 'code' ? '🔑 Code' : q.verification_type === 'location' ? '📍 GPS' : '🔑📍 Both'}</span>`
        : '';
      return `
      <tr>
        <td>${escapeHtml(q.id)} ${verificationBadge}</td>
        <td>${Number(q.xp)||0}</td>
        <td>${q.is_active ? 'Yes' : 'No'}</td>
        <td>${Number(q.sort_order)||0}</td>
        <td>${q.unlock_code ? '✓' : '—'}</td>
        <td>
          <button class="btn-secondary" onclick="handleQuestEdit('${q.id}')">Edit</button>
          <button class="btn-secondary user-detail-danger" onclick="handleQuestDelete('${q.id}')">Delete</button>
        </td>
      </tr>
    `}).join('');
  } catch (e) {
    showToast('Failed to load quests', 'error');
  }
}

async function openQuestForm(mode, quest) {
  adminState.questFormMode = mode;
  adminState.selectedQuest = quest || null;
  const modal = $('#questFormModal');
  const title = $('#questFormTitle');
  const idInput = $('#questId');
  const xpInput = $('#questXp');
  const sortInput = $('#questSort');
  const activeSelect = $('#questActive');
  
  if (!modal || !title || !idInput || !xpInput || !sortInput || !activeSelect) return;
  
  // Set basic fields
  if (mode === 'edit' && quest) {
    title.textContent = 'Edit Quest';
    idInput.value = quest.id;
    idInput.disabled = true;
    xpInput.value = Number(quest.xp)||0;
    sortInput.value = Number(quest.sort_order)||1000;
    activeSelect.value = quest.is_active ? 'true' : 'false';
  } else {
    title.textContent = 'New Quest';
    idInput.value = '';
    idInput.disabled = false;
    xpInput.value = 0;
    sortInput.value = 1000;
    activeSelect.value = 'true';
  }
  
  // Render i18n components for title and description
  if (window.renderI18nInput) {
    const titleContainer = $('#questTitleI18nContainer');
    const descContainer = $('#questDescriptionI18nContainer');
    
    if (titleContainer) {
      const titleData = (mode === 'edit' && quest?.title_i18n) 
        ? quest.title_i18n 
        : (mode === 'edit' && quest?.title) 
          ? { pl: quest.title } 
          : {};
      
      titleContainer.innerHTML = window.renderI18nInput({
        fieldName: 'title',
        label: 'Title',
        type: 'text',
        placeholder: 'Quest title',
        currentValues: titleData
      });
    }
    
    if (descContainer) {
      const descData = (mode === 'edit' && quest?.description_i18n) 
        ? quest.description_i18n 
        : (mode === 'edit' && quest?.description) 
          ? { pl: quest.description } 
          : {};
      
      descContainer.innerHTML = window.renderI18nInput({
        fieldName: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        placeholder: 'Quest description (optional)',
        currentValues: descData
      });
    }
  }
  
  // Set verification fields
  const verifyType = $('#questVerificationType');
  const unlockCode = $('#questUnlockCode');
  const latitude = $('#questLatitude');
  const longitude = $('#questLongitude');
  const locationRadius = $('#questLocationRadius');
  const recommendationSelect = $('#questRecommendationId');
  
  if (mode === 'edit' && quest) {
    if (verifyType) verifyType.value = quest.verification_type || 'none';
    if (unlockCode) unlockCode.value = quest.unlock_code || '';
    if (latitude) latitude.value = quest.latitude || '';
    if (longitude) longitude.value = quest.longitude || '';
    if (locationRadius) locationRadius.value = quest.location_radius || 100;
    if (recommendationSelect) recommendationSelect.value = quest.recommendation_id || '';
  } else {
    if (verifyType) verifyType.value = 'none';
    if (unlockCode) unlockCode.value = '';
    if (latitude) latitude.value = '';
    if (longitude) longitude.value = '';
    if (locationRadius) locationRadius.value = 100;
    if (recommendationSelect) recommendationSelect.value = '';
  }
  
  // Render location name i18n
  const locNameContainer = $('#questLocationNameI18nContainer');
  if (locNameContainer && window.renderI18nInput) {
    const locNameData = (mode === 'edit' && quest?.location_name_i18n) ? quest.location_name_i18n : {};
    locNameContainer.innerHTML = window.renderI18nInput({
      fieldName: 'location_name',
      label: 'Location Name',
      type: 'text',
      placeholder: 'e.g., Local Shop, Beach Bar',
      currentValues: locNameData
    });
  }
  
  // Toggle visibility of verification fields
  toggleQuestVerificationFields(verifyType?.value || 'none');
  
  // Load recommendations for dropdown
  await loadRecommendationsForQuestForm();
  if (mode === 'edit' && quest?.recommendation_id) {
    if (recommendationSelect) recommendationSelect.value = quest.recommendation_id;
  }
  
  showElement(modal);
}

function toggleQuestVerificationFields(type) {
  const codeFields = $('#questCodeFields');
  const locationFields = $('#questLocationFields');
  
  if (codeFields) {
    codeFields.style.display = (type === 'code' || type === 'both') ? 'block' : 'none';
  }
  if (locationFields) {
    locationFields.style.display = (type === 'location' || type === 'both') ? 'block' : 'none';
  }
}

async function loadRecommendationsForQuestForm() {
  const select = $('#questRecommendationId');
  if (!select) return;
  
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data: recs, error } = await client
      .from('recommendations')
      .select('id, title_pl, title_en, latitude, longitude')
      .eq('active', true)
      .order('title_en', { ascending: true });
    
    if (error) throw error;
    
    // Keep first option and rebuild
    select.innerHTML = '<option value="">-- None --</option>';
    
    if (Array.isArray(recs)) {
      recs.forEach(rec => {
        const title = rec.title_pl || rec.title_en || 'Unnamed';
        const hasLocation = rec.latitude && rec.longitude;
        const option = document.createElement('option');
        option.value = rec.id;
        option.textContent = `${title}${hasLocation ? ' 📍' : ''}`;
        option.dataset.lat = rec.latitude || '';
        option.dataset.lng = rec.longitude || '';
        select.appendChild(option);
      });
    }
  } catch (e) {
    console.error('Failed to load recommendations for quest form:', e);
  }
}

function handleRecommendationSelect(e) {
  const select = e.target;
  const selectedOption = select.options[select.selectedIndex];
  
  if (!selectedOption || !selectedOption.value) return;
  
  const lat = selectedOption.dataset.lat;
  const lng = selectedOption.dataset.lng;
  
  if (lat && lng) {
    const latInput = $('#questLatitude');
    const lngInput = $('#questLongitude');
    
    // Only fill if empty
    if (latInput && !latInput.value) latInput.value = lat;
    if (lngInput && !lngInput.value) lngInput.value = lng;
    
    showToast('Location auto-filled from recommendation', 'info');
  }
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
  
  // Get basic fields
  const id = ($('#questId').value || '').trim();
  const xp = Number($('#questXp').value || '0') || 0;
  const sort_order = Number($('#questSort').value || '1000') || 1000;
  const is_active = $('#questActive').value === 'true';
  
  // Get verification fields
  const verification_type = $('#questVerificationType')?.value || 'none';
  const unlock_code = ($('#questUnlockCode')?.value || '').trim().toUpperCase() || null;
  const latitude = $('#questLatitude')?.value ? parseFloat($('#questLatitude').value) : null;
  const longitude = $('#questLongitude')?.value ? parseFloat($('#questLongitude').value) : null;
  const location_radius = parseInt($('#questLocationRadius')?.value) || 100;
  const recommendation_id = $('#questRecommendationId')?.value || null;
  
  // Validate verification settings
  if (verification_type === 'code' || verification_type === 'both') {
    if (!unlock_code || unlock_code.length < 4) {
      showToast('Unlock code must be at least 4 characters', 'error');
      return;
    }
  }
  
  if (verification_type === 'location' || verification_type === 'both') {
    if (!latitude || !longitude) {
      showToast('Latitude and Longitude are required for location verification', 'error');
      return;
    }
  }
  
  // Extract i18n values
  const fd = new FormData($('#questForm'));
  const titleI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'title') : null;
  const descriptionI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'description') : null;
  const locationNameI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'location_name') : null;
  
  // Validate title (at least one language required)
  if (window.validateI18nField) {
    const titleError = window.validateI18nField(titleI18n, 'Title');
    if (titleError) {
      showToast(titleError, 'error');
      return;
    }
  }
  
  // Build payload
  const payload = { 
    id, 
    xp, 
    sort_order, 
    is_active, 
    category: 'quest',
    verification_type,
    unlock_code: (verification_type === 'code' || verification_type === 'both') ? unlock_code : null,
    latitude: (verification_type === 'location' || verification_type === 'both') ? latitude : null,
    longitude: (verification_type === 'location' || verification_type === 'both') ? longitude : null,
    location_radius: (verification_type === 'location' || verification_type === 'both') ? location_radius : 100,
    recommendation_id: recommendation_id || null
  };
  
  // Add i18n fields
  if (titleI18n) payload.title_i18n = titleI18n;
  if (descriptionI18n) payload.description_i18n = descriptionI18n;
  if (locationNameI18n && (verification_type === 'location' || verification_type === 'both')) {
    payload.location_name_i18n = locationNameI18n;
  }
  
  // Clean legacy fields (for backward compatibility)
  payload.title = null;
  payload.description = null;
  
  try {
    const { error } = await client.from('tasks').upsert(payload);
    if (error) throw error;
    showToast('Quest saved', 'success');
    hideElement($('#questFormModal'));
    await loadQuestsData();
  } catch (e) {
    console.error('Quest save error:', e);
    showToast('Failed to save quest: ' + (e.message || 'Unknown error'), 'error');
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
  
  // Verification type toggle
  const verifyTypeSelect = $('#questVerificationType');
  if (verifyTypeSelect) {
    verifyTypeSelect.addEventListener('change', (e) => toggleQuestVerificationFields(e.target.value));
  }
  
  // Recommendation select - auto-fill location
  const recSelect = $('#questRecommendationId');
  if (recSelect) {
    recSelect.addEventListener('change', handleRecommendationSelect);
  }
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
      // Fetch all cars for this location
      const { data: carOffers } = await client
        .from('car_offers')
        .select('*')
        .eq('location', (booking.location || 'larnaca').toLowerCase());
      
      // Find matching car by comparing car_model in any language
      // booking.car_model is a string like "Nissan Note Hybrid (2023)"
      // car.car_model is JSONB like {"pl": "...", "en": "..."}
      const carOffer = carOffers?.find(car => {
        if (typeof car.car_model === 'string') {
          // Legacy: direct string comparison
          return car.car_model === booking.car_model;
        } else if (car.car_model && typeof car.car_model === 'object') {
          // i18n: check all language variants
          return car.car_model.pl === booking.car_model ||
                 car.car_model.en === booking.car_model ||
                 car.car_model.el === booking.car_model ||
                 car.car_model.he === booking.car_model;
        }
        return false;
      });
      
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

async function deleteCarBooking(bookingId) {
  if (!bookingId) return;

  const confirmed = confirm('Are you sure you want to delete this booking? This action cannot be undone.');
  if (!confirmed) return;

  const typed = prompt('Type DELETE to confirm deletion:');
  if (typed !== 'DELETE') {
    showToast('Deletion cancelled', 'info');
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    try {
      await client
        .from('partner_service_fulfillments')
        .delete()
        .eq('resource_type', 'cars')
        .eq('booking_id', bookingId);
    } catch (_e) {
    }

    const { error } = await client
      .from('car_bookings')
      .delete()
      .eq('id', bookingId);

    if (error) throw error;

    showToast('Booking deleted successfully', 'success');
    const modal = $('#bookingDetailsModal');
    if (modal) modal.hidden = true;
    await loadCarsData();
  } catch (e) {
    console.error('Failed to delete booking:', e);
    showToast('Failed to delete booking: ' + (e.message || 'Unknown error'), 'error');
  }
}

// Make functions global for onclick handlers
window.viewCarBookingDetails = viewCarBookingDetails;
window.loadCarsData = loadCarsData;
window.openEditBooking = openEditBooking;
window.updateBookingStatus = updateBookingStatus;
window.deleteCarBooking = deleteCarBooking;

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
    // Store ordered list globally for reordering helpers
    window.fleetCarsList = Array.isArray(fleetState.cars) ? fleetState.cars.slice() : [];
    console.log(`Loaded ${window.fleetCarsList.length} cars`);

    // Render fleet table
    const tbody = $('#fleetTableBody');
    if (!tbody) return;

    if (!window.fleetCarsList || window.fleetCarsList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="table-loading">No cars found with current filters</td></tr>';
      return;
    }

    tbody.innerHTML = window.fleetCarsList.map((car, index) => {
      // Extract i18n values for display (prefer Polish, fallback to English)
      const carModel = car.car_model?.pl || car.car_model?.en || car.car_model || 'Unknown';
      const carType = car.car_type?.pl || car.car_type?.en || car.car_type || '';
      const carDesc = car.description?.pl || car.description?.en || car.description || '';
      
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
        ? `<img src="${escapeHtml(car.image_url)}" alt="${escapeHtml(carModel)}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;">`
        : `<div style="width: 60px; height: 40px; background: var(--admin-border); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🚗</div>`;

      const sortOrder = typeof car.sort_order === 'number' ? car.sort_order : (index + 1);

      return `
        <tr>
          <td>${imageDisplay}</td>
          <td>
            <span class="badge ${car.location === 'larnaca' ? 'badge-info' : 'badge-warning'}">
              ${car.location.toUpperCase()}
            </span>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
              <span style="font-size:11px;color:var(--admin-text-muted);">#${index + 1}</span>
              <div style="display:flex;flex-direction:column;gap:2px;">
                <button type="button" title="Move up" onclick="moveFleetCarOrder('${car.id}','up')" style="border:1px solid var(--admin-border);background:var(--admin-bg-secondary);color:var(--admin-text);border-radius:4px;padding:0 4px;font-size:10px;line-height:14px;">▲</button>
                <button type="button" title="Move down" onclick="moveFleetCarOrder('${car.id}','down')" style="border:1px solid var(--admin-border);background:var(--admin-bg-secondary);color:var(--admin-text);border-radius:4px;padding:0 4px;font-size:10px;line-height:14px;">▼</button>
              </div>
              <span style="font-size:10px;color:var(--admin-text-muted);">${sortOrder}</span>
            </div>
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(carModel)}</div>
            <div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(carDesc.substring(0, 40))}${carDesc.length > 40 ? '...' : ''}</div>
          </td>
          <td>${escapeHtml(carType)}</td>
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
              <button class="btn-icon" type="button" title="Delete" onclick="deleteFleetCar('${car.id}', '${escapeHtml(carModel)}')" style="color: var(--admin-danger);">
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
      tbody.innerHTML = `<tr><td colspan="11" class="table-loading" style="color: var(--admin-danger);">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
  }
}

async function moveFleetCarOrder(carId, direction) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const list = Array.isArray(window.fleetCarsList) ? window.fleetCarsList : [];
    const index = list.findIndex(c => c.id === carId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) {
      showToast('Cannot move further', 'info');
      return;
    }

    const current = list[index];
    const target = list[targetIndex];
    const currentOrder = typeof current.sort_order === 'number' ? current.sort_order : (index + 1);
    const targetOrder = typeof target.sort_order === 'number' ? target.sort_order : (targetIndex + 1);

    const { error: err1 } = await client
      .from('car_offers')
      .update({ sort_order: targetOrder })
      .eq('id', current.id);
    if (err1) throw err1;

    const { error: err2 } = await client
      .from('car_offers')
      .update({ sort_order: currentOrder })
      .eq('id', target.id);
    if (err2) throw err2;

    showToast('Car order updated', 'success');
    await loadFleetData();
  } catch (e) {
    console.error('Failed to update car order:', e);
    showToast('Failed to update order: ' + (e.message || 'Unknown error'), 'error');
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
  // All cars use i18n (car_model, car_type, description are JSONB)
  const useI18n = true;
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
        currentValues: carData?.car_model || {}
      });
    }
    
    if (carDescContainer) {
      carDescContainer.innerHTML = window.renderI18nInput({
        fieldName: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        placeholder: 'Short description of the car',
        currentValues: carData?.description || {}
      });
    }
    
    // Render features i18n (array input)
    const featuresContainer = $('#featuresI18n');
    if (featuresContainer && window.renderI18nArrayInput) {
      featuresContainer.innerHTML = window.renderI18nArrayInput({
        fieldName: 'features',
        label: 'Features',
        rows: 5,
        placeholder: 'Air Conditioning\nBluetooth\nGPS Navigation',
        currentValues: carData?.features || {}
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
    const modelDisplay = carData.car_model?.pl || carData.car_model?.en || 'this car';
    title.textContent = `Edit ${modelDisplay}`;
    
    // Fill form with existing data
    $('#fleetCarId').value = carData.id;
    $('#fleetCarLocation').value = carData.location || '';
    // Extract English car_type to match dropdown options
    const carTypeValue = carData.car_type?.en || carData.car_type || '';
    $('#fleetCarType').value = carTypeValue;
    
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
    
    // Features are now handled by i18n component (renderI18nArrayInput)
    // No need to manually set #fleetCarFeatures as it doesn't exist anymore
    // Features are loaded in the i18n rendering section above (lines 4264-4274)
    
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
    let carModelI18n, descriptionI18n, featuresI18n;
    
    if (usingI18n && window.extractI18nValues) {
      // Extract i18n values
      const formData = new FormData(form);
      carModelI18n = window.extractI18nValues(formData, 'car_model');
      descriptionI18n = window.extractI18nValues(formData, 'description');
      
      // Extract features i18n (array values)
      if (window.extractI18nArrayValues) {
        featuresI18n = window.extractI18nArrayValues(formData, 'features');
      }
      
      console.log('🔍 Extracted car i18n values:', { carModelI18n, descriptionI18n, featuresI18n });
      
      // Validate i18n fields
      if (window.validateI18nField) {
        const modelError = window.validateI18nField(carModelI18n, 'Car Model');
        if (modelError) {
          console.error('❌ Validation error:', modelError);
          throw new Error(modelError);
        }
        console.log('✅ Validation passed');
      }
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
    
    // Save i18n fields directly to car_model, description, and features (JSONB columns)
    if (usingI18n && window.extractI18nValues) {
      if (carModelI18n) carData.car_model = carModelI18n;
      if (descriptionI18n) carData.description = descriptionI18n;
      if (featuresI18n) carData.features = featuresI18n;
      
      // Clean up legacy fields
      delete carData.car_model_pl;
      delete carData.car_model_en;
      delete carData.car_model_el;
      delete carData.car_model_he;
      delete carData.description_pl;
      delete carData.description_en;
      delete carData.description_el;
      delete carData.description_he;
    } else {
      // Legacy mode - save as text
      carData.car_model = carModel;
      carData.description = description;
      
      // Parse features from legacy textarea (one per line)
      const featuresText = $('#fleetCarFeatures')?.value?.trim() || '';
      if (featuresText) {
        const featuresArray = featuresText
          .split('\n')
          .map(f => f.trim())
          .filter(f => f.length > 0);
        carData.features = featuresArray;
      } else {
        carData.features = [];
      }
    }
    
    console.log('💾 Car payload:', carData);

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
window.moveFleetCarOrder = moveFleetCarOrder;
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

const diagnosticsState = {
  statuses: {},
};

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
    {
      id: 'check_hotels_sort_order',
      title: 'Hotels: sort_order & publication',
      description: 'Detects hotels with missing sort_order or unpublished but ordered items',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('hotels')
            .select('id, slug, sort_order, is_published')
            .order('sort_order', { ascending: true })
            .limit(100);
          if (error) throw error;
          const items = Array.isArray(data) ? data : [];
          const missingOrder = items.filter(h => h.sort_order == null).length;
          const unpublishedWithOrder = items.filter(h => h.is_published === false && h.sort_order != null).length;
          if (!items.length) {
            return { status: 'ok', details: 'No hotels in sample' };
          }
          if (missingOrder || unpublishedWithOrder) {
            return {
              status: 'warn',
              details: `Missing sort_order: ${missingOrder}, unpublished with sort_order: ${unpublishedWithOrder} (sample 100)`,
            };
          }
          return { status: 'ok', details: 'All sampled hotels have sort_order set' };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_hotels_cover_image',
      title: 'Hotels: missing cover image',
      description: 'Detects hotels without cover_image_url',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('hotels')
            .select('id, slug, cover_image_url')
            .or('cover_image_url.is.null,cover_image_url.eq.')
            .limit(5);
          if (error) throw error;
          const missing = Array.isArray(data) ? data.length : 0;
          return {
            status: missing ? 'warn' : 'ok',
            details: missing ? `Found ${missing} hotels without cover image (sample shown)` : 'OK (all have image in sample)',
          };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_cars_sort_order',
      title: 'Cars: sort_order & availability',
      description: 'Detects cars with missing sort_order or unavailable but ordered items',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('car_offers')
            .select('id, car_model, sort_order, is_available')
            .order('sort_order', { ascending: true })
            .limit(100);
          if (error) throw error;
          const items = Array.isArray(data) ? data : [];
          const missingOrder = items.filter(c => c.sort_order == null).length;
          const unavailableWithOrder = items.filter(c => c.is_available === false && c.sort_order != null).length;
          if (!items.length) {
            return { status: 'ok', details: 'No cars in sample' };
          }
          if (missingOrder || unavailableWithOrder) {
            return {
              status: 'warn',
              details: `Missing sort_order: ${missingOrder}, unavailable with sort_order: ${unavailableWithOrder} (sample 100)`,
            };
          }
          return { status: 'ok', details: 'All sampled cars have sort_order set' };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_cars_image_url',
      title: 'Cars: missing image_url',
      description: 'Detects cars without image_url',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('car_offers')
            .select('id, car_model, image_url')
            .or('image_url.is.null,image_url.eq.')
            .limit(5);
          if (error) throw error;
          const missing = Array.isArray(data) ? data.length : 0;
          return {
            status: missing ? 'warn' : 'ok',
            details: missing ? `Found ${missing} cars without image (sample shown)` : 'OK (all have image in sample)',
          };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
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
  updateDiagnosticsSummary();
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
    diagnosticsState.statuses[check.id] = status;
    if (statusCell) {
      const cls = status === 'ok' ? 'badge-success' : status === 'warn' ? 'badge-warning' : 'badge-danger';
      const label = status === 'ok' ? 'OK' : status === 'warn' ? 'Warning' : 'Error';
      statusCell.innerHTML = `<span class="badge ${cls}">${label}</span>`;
    }
    if (detailsCell) detailsCell.textContent = details;
    updateDiagnosticsSummary();
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
  updateDiagnosticsSummary();
  showToast('All checks completed', 'success');
}

function updateDiagnosticsSummary() {
  const statuses = diagnosticsState.statuses || {};
  const values = Object.values(statuses);
  const total = values.length;
  const ok = values.filter(s => s === 'ok').length;
  const warn = values.filter(s => s === 'warn').length;
  const error = values.filter(s => s === 'error').length;

  const totalEl = document.getElementById('diagStatTotal');
  const warnEl = document.getElementById('diagStatWarnings');
  const errorEl = document.getElementById('diagStatErrors');
  if (totalEl) totalEl.textContent = total || 0;
  if (warnEl) warnEl.textContent = warn || 0;
  if (errorEl) errorEl.textContent = error || 0;

  const barOk = document.getElementById('diagBarOk');
  const barWarn = document.getElementById('diagBarWarn');
  const barError = document.getElementById('diagBarError');
  const safeTotal = total || 1;
  const okPct = Math.round((ok / safeTotal) * 100);
  const warnPct = Math.round((warn / safeTotal) * 100);
  const errorPct = 100 - okPct - warnPct;
  if (barOk) barOk.style.width = `${okPct}%`;
  if (barWarn) barWarn.style.width = `${warnPct}%`;
  if (barError) barError.style.width = `${errorPct}%`;
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

  const btnDeleteBooking = $('#btnDeleteBooking');
  if (btnDeleteBooking) {
    btnDeleteBooking.addEventListener('click', async () => {
      const modal = $('#bookingDetailsModal');
      const bookingId = modal?.dataset?.bookingId;
      if (!bookingId) return;
      await deleteCarBooking(bookingId);
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
        <!-- Engagement & activity -->
        <div class="admin-stats-grid" style="margin-bottom:24px;">
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Comments Today</p>
              <p class="stat-card-value">${contentStats.comments_today || 0}</p>
              <p class="stat-card-change">New comments in last 24h</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Comments This Week</p>
              <p class="stat-card-value">${contentStats.comments_this_week || 0}</p>
              <p class="stat-card-change">Last 7 days</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Comments This Month</p>
              <p class="stat-card-value">${contentStats.comments_this_month || 0}</p>
              <p class="stat-card-change">Last 30 days</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Active Users Today</p>
              <p class="stat-card-value">${contentStats.active_users_today || 0}</p>
              <p class="stat-card-change">Unique users today</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Active Users (7 days)</p>
              <p class="stat-card-value">${contentStats.active_users_week || 0}</p>
              <p class="stat-card-change">Unique users in last 7 days</p>
            </div>
          </div>
        </div>

        <!-- Content totals -->
        <div class="admin-stats-grid">
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total POIs</p>
              <p class="stat-card-value">${contentStats.total_pois || 0}</p>
              <p class="stat-card-change">All attractions in system</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Comments</p>
              <p class="stat-card-value">${contentStats.total_comments || 0}</p>
              <p class="stat-card-change">All user comments</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Ratings</p>
              <p class="stat-card-value">${contentStats.total_ratings || 0}</p>
              <p class="stat-card-change">Number of rating events</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Visits</p>
              <p class="stat-card-value">${contentStats.total_visits || 0}</p>
              <p class="stat-card-change">Recorded POI visits</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Average Rating</p>
              <p class="stat-card-value">${contentStats.avg_rating != null ? contentStats.avg_rating : 'N/A'}</p>
              <p class="stat-card-change">Across all rated POIs</p>
            </div>
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
      // Map car booking fields to unified format
      customer_name: booking.full_name || booking.customer_name || 'N/A',
      customer_email: booking.email || booking.customer_email || '',
      customer_phone: booking.phone || booking.customer_phone || '',
      dropoff_date: booking.return_date || booking.dropoff_date,
      displayName: `${booking.car_model || booking.car_type || 'N/A'} - ${booking.pickup_location || 'N/A'}`,
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

// =====================================================
// RECOMMENDATIONS MODULE
// =====================================================

let recommendationsCache = [];
let recommendationsCategories = [];
let currentRecommendation = null;
let recommendationFormMode = 'create';

// Load Recommendations Data
async function loadRecommendationsData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log('Loading recommendations data...');

    // Load categories first
    const { data: categories, error: catError } = await client
      .from('recommendation_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (catError) {
      console.error('Error loading categories:', catError);
      showToast('Failed to load categories', 'error');
      return;
    }

    recommendationsCategories = categories || [];
    console.log('Categories loaded:', recommendationsCategories.length);

    // Load recommendations
    const { data: recommendations, error } = await client
      .from('recommendations')
      .select('*, recommendation_categories(name_en, icon, color)')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading recommendations:', error);
      showToast('Failed to load recommendations', 'error');
      return;
    }

    recommendationsCache = recommendations || [];
    console.log('Recommendations loaded:', recommendationsCache.length);

    // Update UI
    updateRecommendationsStats();
    updateRecommendationsTable();
    populateCategoryFilters();

  } catch (error) {
    console.error('Error in loadRecommendationsData:', error);
    showToast('Failed to load recommendations data', 'error');
  }
}

// Update Stats
function updateRecommendationsStats() {
  const total = recommendationsCache.length;
  const active = recommendationsCache.filter(r => r.active).length;
  const totalViews = recommendationsCache.reduce((sum, r) => sum + (r.view_count || 0), 0);
  const totalClicks = recommendationsCache.reduce((sum, r) => sum + (r.click_count || 0), 0);

  $('#statTotalRecommendations').textContent = total;
  $('#statActiveRecommendations').textContent = active;
  $('#statTotalViews').textContent = totalViews.toLocaleString();
  $('#statTotalClicks').textContent = totalClicks.toLocaleString();
}

// Populate Category Filters
function populateCategoryFilters() {
  const select = $('#recommendationCategoryFilter');
  if (!select) return;

  // Clear and rebuild
  select.innerHTML = '<option value="">All Categories</option>';
  
  recommendationsCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = `${cat.name_pl || cat.name_en} / ${cat.name_en}`;
    select.appendChild(option);
  });
}

// Update Table
function updateRecommendationsTable() {
  const tbody = $('#recommendationsTableBody');
  if (!tbody) return;

  const searchTerm = $('#recommendationSearchInput')?.value.toLowerCase() || '';
  const categoryFilter = $('#recommendationCategoryFilter')?.value || '';
  const statusFilter = $('#recommendationStatusFilter')?.value || '';

  let filtered = recommendationsCache.filter(rec => {
    // Search filter
    if (searchTerm && !rec.title_pl?.toLowerCase().includes(searchTerm) && 
        !rec.title_en?.toLowerCase().includes(searchTerm) &&
        !rec.location_name?.toLowerCase().includes(searchTerm)) {
      return false;
    }

    // Category filter
    if (categoryFilter && rec.category_id !== categoryFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'active' && !rec.active) return false;
    if (statusFilter === 'inactive' && rec.active) return false;
    if (statusFilter === 'featured' && !rec.featured) return false;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="table-empty">No recommendations found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(rec => {
    const category = rec.recommendation_categories || {};
    const statusBadge = rec.active ? 
      '<span class="badge badge-success">Active</span>' : 
      '<span class="badge badge-secondary">Inactive</span>';
    const featuredBadge = rec.featured ? 
      '<span class="badge badge-warning" style="margin-left: 4px;">Featured</span>' : '';

    return `
      <tr>
        <td>
          ${rec.image_url ? 
            `<img src="${rec.image_url}" alt="${rec.title_en}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;">` : 
            '<div style="width: 60px; height: 60px; background: var(--admin-bg-secondary); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📍</div>'
          }
        </td>
        <td style="font-weight: 600;">${rec.display_order}</td>
        <td>
          <div style="font-weight: 600;">${rec.title_pl || rec.title_en || 'Untitled'}</div>
          <div style="font-size: 11px; color: var(--admin-text-secondary); margin-top: 2px;">${rec.title_en || ''}</div>
          <div style="font-size: 12px; color: var(--admin-text-muted); margin-top: 4px;">${rec.description_pl?.substring(0, 60) || rec.description_en?.substring(0, 60) || ''}${(rec.description_pl || rec.description_en)?.length > 60 ? '...' : ''}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 18px;">${category.icon || '📍'}</span>
            <div>
              <div>${category.name_pl || category.name_en || 'N/A'}</div>
              <div style="font-size: 11px; color: var(--admin-text-muted);">${category.name_en || ''}</div>
            </div>
          </div>
        </td>
        <td>${rec.location_name || 'N/A'}</td>
        <td>${rec.view_count || 0}</td>
        <td>${rec.click_count || 0}</td>
        <td>${rec.promo_code || '-'}</td>
        <td>${statusBadge}${featuredBadge}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-secondary" onclick="editRecommendation('${rec.id}')" title="Edit" style="font-size: 13px; padding: 4px 8px;">
              Edit
            </button>
            <button class="btn-danger" onclick="deleteRecommendation('${rec.id}')" title="Delete" style="font-size: 13px; padding: 4px 8px;">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Create Modal
async function openCreateRecommendationModal() {
  window.recommendationFormMode = 'create';
  currentRecommendation = null;
  
  console.log('🔵 Opening create modal, categories count:', recommendationsCategories.length);
  console.log('🔵 Categories:', recommendationsCategories);
  
  // Ensure categories are loaded
  if (recommendationsCategories.length === 0) {
    console.log('⚠️ Categories not loaded, loading now...');
    await loadRecommendationsData();
    console.log('✅ Categories loaded:', recommendationsCategories.length);
  }
  
  $('#recommendationFormTitle').textContent = 'New Recommendation';
  
  // Make sure recommendationsCategories is globally accessible for the form
  window.recommendationsCategories = recommendationsCategories;
  
  // Render i18n form
  const formContent = $('#recommendationFormContent');
  formContent.innerHTML = renderRecommendationI18nForm(null);
  
  showElement($('#recommendationFormModal'));
}

// Open Edit Modal
async function editRecommendation(id) {
  const rec = recommendationsCache.find(r => r.id === id);
  if (!rec) {
    showToast('Recommendation not found', 'error');
    return;
  }

  window.recommendationFormMode = 'edit';
  currentRecommendation = rec;
  
  console.log('🔵 Opening edit modal, categories count:', recommendationsCategories.length);
  
  // Ensure categories are loaded
  if (recommendationsCategories.length === 0) {
    console.log('⚠️ Categories not loaded, loading now...');
    await loadRecommendationsData();
    console.log('✅ Categories loaded:', recommendationsCategories.length);
  }
  
  $('#recommendationFormTitle').textContent = 'Edit Recommendation';
  
  // Make sure recommendationsCategories is globally accessible for the form
  window.recommendationsCategories = recommendationsCategories;
  
  // Render i18n form with data
  const formContent = $('#recommendationFormContent');
  formContent.innerHTML = renderRecommendationI18nForm(rec);
  
  showElement($('#recommendationFormModal'));
}

// Delete Recommendation
async function deleteRecommendation(id) {
  if (!confirm('Are you sure you want to delete this recommendation?')) {
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const { error } = await client
      .from('recommendations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Recommendation deleted successfully', 'success');
    await loadRecommendationsData();

  } catch (error) {
    console.error('Error deleting recommendation:', error);
    showToast('Failed to delete recommendation: ' + error.message, 'error');
  }
}

// Initialize Recommendations Module
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing Recommendations module...');

  // Buttons
  const btnAdd = $('#btnAddRecommendation');
  if (btnAdd) {
    btnAdd.addEventListener('click', openCreateRecommendationModal);
  }

  const btnRefresh = $('#btnRefreshRecommendations');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadRecommendationsData);
  }

  const btnClose = $('#btnCloseRecommendationForm');
  if (btnClose) {
    btnClose.addEventListener('click', closeRecI18nForm);
  }

  // Modal overlay
  const overlay = $('#recommendationFormModalOverlay');
  if (overlay) {
    overlay.addEventListener('click', closeRecI18nForm);
  }

  // Filters
  const searchInput = $('#recommendationSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', updateRecommendationsTable);
  }

  const categoryFilter = $('#recommendationCategoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', updateRecommendationsTable);
  }

  const statusFilter = $('#recommendationStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', updateRecommendationsTable);
  }
});

// Export functions
window.loadRecommendationsData = loadRecommendationsData;
window.editRecommendation = editRecommendation;
window.deleteRecommendation = deleteRecommendation;

// =====================================================
// REFERRAL SYSTEM ADMIN PANEL
// =====================================================

let referralsCache = [];
let referralUsersCache = {};
let referralCurrentPage = 1;
const REFERRALS_PER_PAGE = 20;

/**
 * Load referral XP settings
 */
async function loadReferralSettings() {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', 'referral_xp')
      .single();

    if (data?.value?.amount) {
      const input = document.getElementById('referralXpAmount');
      if (input) input.value = data.value.amount;
    }
  } catch (e) {
    console.warn('Could not load referral settings:', e);
  }
}

/**
 * Save referral XP settings
 */
async function saveReferralXpSettings() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database not available', 'error');
      return;
    }

    const input = document.getElementById('referralXpAmount');
    const amount = parseInt(input?.value) || 100;

    const { error } = await client
      .from('app_settings')
      .update({ 
        value: { amount, bonus_for_referred: 0, auto_confirm: false },
        updated_at: new Date().toISOString()
      })
      .eq('key', 'referral_xp');

    if (error) throw error;
    showToast('Referral XP settings saved!', 'success');
  } catch (e) {
    console.error('Failed to save referral settings:', e);
    showToast('Failed to save settings: ' + e.message, 'error');
  }
}

/**
 * Load all referrals with user data
 */
async function loadReferralsData() {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const tbody = document.getElementById('referralsTable');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading referrals...</td></tr>';

    // Load referrals
    const { data: referrals, error } = await client
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    referralsCache = referrals || [];

    // Get unique user IDs
    const userIds = new Set();
    referrals?.forEach(r => {
      if (r.referrer_id) userIds.add(r.referrer_id);
      if (r.referred_id) userIds.add(r.referred_id);
    });

    // Load user profiles
    if (userIds.size > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, username, email, name')
        .in('id', Array.from(userIds));

      referralUsersCache = {};
      profiles?.forEach(p => {
        referralUsersCache[p.id] = p;
      });
    }

    renderReferralsTable();
  } catch (e) {
    console.error('Failed to load referrals:', e);
    const tbody = document.getElementById('referralsTable');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-danger">Error loading referrals</td></tr>';
  }
}

/**
 * Render referrals table with pagination
 */
function renderReferralsTable() {
  const tbody = document.getElementById('referralsTable');
  if (!tbody) return;

  // Apply filters
  const searchTerm = document.getElementById('referralSearch')?.value?.toLowerCase() || '';
  const statusFilter = document.getElementById('referralStatusFilter')?.value || '';

  let filtered = referralsCache.filter(r => {
    const referrer = referralUsersCache[r.referrer_id];
    const referred = referralUsersCache[r.referred_id];
    
    const matchesSearch = !searchTerm || 
      referrer?.username?.toLowerCase().includes(searchTerm) ||
      referrer?.email?.toLowerCase().includes(searchTerm) ||
      referred?.username?.toLowerCase().includes(searchTerm) ||
      referred?.email?.toLowerCase().includes(searchTerm);
    
    const matchesStatus = !statusFilter || r.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / REFERRALS_PER_PAGE);
  const start = (referralCurrentPage - 1) * REFERRALS_PER_PAGE;
  const pageData = filtered.slice(start, start + REFERRALS_PER_PAGE);

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center">No referrals found</td></tr>';
  } else {
    tbody.innerHTML = pageData.map(r => {
      const referrer = referralUsersCache[r.referrer_id] || {};
      const referred = referralUsersCache[r.referred_id] || {};
      const statusClass = r.status === 'confirmed' ? 'status-active' : 
                         r.status === 'rejected' ? 'status-inactive' : 'status-pending';
      const statusIcon = r.status === 'confirmed' ? '✅' : 
                        r.status === 'rejected' ? '❌' : '⏳';
      
      return `
        <tr>
          <td>
            <strong>${referrer.username || 'Unknown'}</strong>
            <br><small class="text-muted">${referrer.email || ''}</small>
          </td>
          <td>
            <strong>${referred.username || 'Unknown'}</strong>
            <br><small class="text-muted">${referred.email || ''}</small>
          </td>
          <td>${new Date(r.created_at).toLocaleDateString('pl-PL')}</td>
          <td><span class="status-badge ${statusClass}">${statusIcon} ${r.status}</span></td>
          <td>${r.xp_awarded || 0} XP</td>
          <td>
            ${r.status === 'pending' ? `
              <button class="btn-action btn-success" onclick="confirmReferral('${r.id}')" title="Confirm">✓</button>
              <button class="btn-action btn-danger" onclick="rejectReferral('${r.id}')" title="Reject">✗</button>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update pagination info
  const paginationInfo = document.getElementById('referralsPaginationInfo');
  if (paginationInfo) {
    paginationInfo.textContent = `Page ${referralCurrentPage} of ${totalPages || 1} (${filtered.length} total)`;
  }

  // Update pagination buttons
  const btnPrev = document.getElementById('btnReferralsPrev');
  const btnNext = document.getElementById('btnReferralsNext');
  if (btnPrev) btnPrev.disabled = referralCurrentPage <= 1;
  if (btnNext) btnNext.disabled = referralCurrentPage >= totalPages;
}

/**
 * Confirm a referral and award XP
 */
async function confirmReferral(referralId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { data, error } = await client.rpc('confirm_referral', { referral_id: referralId });
    
    if (error) throw error;
    
    if (data?.success) {
      showToast(`Referral confirmed! ${data.xp_awarded} XP awarded`, 'success');
    } else {
      showToast(data?.error || 'Failed to confirm', 'error');
    }
    
    await loadReferralsData();
    await loadReferralStats();
  } catch (e) {
    console.error('Failed to confirm referral:', e);
    showToast('Error confirming referral: ' + e.message, 'error');
  }
}
window.confirmReferral = confirmReferral;

/**
 * Reject a referral
 */
async function rejectReferral(referralId) {
  if (!confirm('Are you sure you want to reject this referral?')) return;
  
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { error } = await client
      .from('referrals')
      .update({ status: 'rejected' })
      .eq('id', referralId);
    
    if (error) throw error;
    showToast('Referral rejected', 'success');
    await loadReferralsData();
  } catch (e) {
    console.error('Failed to reject referral:', e);
    showToast('Error rejecting referral: ' + e.message, 'error');
  }
}
window.rejectReferral = rejectReferral;

/**
 * Load referral statistics
 */
async function loadReferralStats() {
  try {
    const client = ensureSupabase();
    if (!client) return;

    // Load stats from view
    const { data: stats } = await client
      .from('referral_stats')
      .select('*')
      .single();

    if (stats) {
      document.getElementById('statTotalReferrals').textContent = stats.total_referrals || 0;
      document.getElementById('statConfirmedReferrals').textContent = stats.confirmed_referrals || 0;
      document.getElementById('statPendingReferrals').textContent = stats.pending_referrals || 0;
      document.getElementById('statTotalXpAwarded').textContent = (stats.total_xp_awarded || 0).toLocaleString();
      document.getElementById('statUniqueReferrers').textContent = stats.unique_referrers || 0;
    }

    // Load top referrers
    const { data: topReferrers } = await client
      .from('top_referrers')
      .select('*')
      .limit(10);

    const topTable = document.getElementById('topReferrersTable');
    if (topTable) {
      if (!topReferrers?.length) {
        topTable.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center">No referrers yet</td></tr>';
      } else {
        topTable.innerHTML = topReferrers.map((r, i) => `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td>
              <strong>${r.username || r.display_name || 'Unknown'}</strong>
            </td>
            <td>${r.referral_count || 0}</td>
            <td>${(r.total_xp_from_referrals || 0).toLocaleString()} XP</td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {
    console.error('Failed to load referral stats:', e);
  }
}

/**
 * Build and render referral tree with expand/collapse functionality
 * Uses both profiles and referrals tables for accuracy
 */
let referralTreeData = []; // Store tree data for expand/collapse all

async function loadReferralTree() {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const container = document.getElementById('referralTreeContainer');
    if (!container) return;
    container.innerHTML = '<p class="text-muted">Loading referral tree data...</p>';

    // 1. Get all profiles
    const { data: profiles, error: profilesError } = await client
      .from('profiles')
      .select('id, username, name, email, created_at, avatar_url');

    if (profilesError) throw profilesError;

    // 2. Get all referral relationships
    const { data: referrals, error: referralsError } = await client
      .from('referrals')
      .select('referrer_id, referred_id, created_at, status');

    if (referralsError) throw referralsError;

    if (!profiles?.length) {
      container.innerHTML = '<p class="text-muted">No profiles found</p>';
      return;
    }

    // Map profiles by ID for easy lookup
    const profileMap = {};
    profiles.forEach(p => { 
      profileMap[p.id] = { 
        ...p, 
        children: [],
        expanded: false,
        is_referrer: false,
        referral_status: null, // Status of being referred
        referral_date: null    // When they were referred
      }; 
    });

    // Build tree using referrals table
    const referredIds = new Set(); // Track who has been referred

    if (referrals?.length) {
      referrals.forEach(ref => {
        const referrer = profileMap[ref.referrer_id];
        const referred = profileMap[ref.referred_id];

        if (referrer && referred) {
          // Add to parent's children
          referrer.children.push(referred);
          referrer.is_referrer = true;
          
          // Mark child details
          referred.referral_status = ref.status;
          referred.referral_date = ref.created_at;
          
          // Mark as referred so we don't add to root later
          referredIds.add(ref.referred_id);
        }
      });
    }

    // Identify root users (those who have referrals but were not referred themselves)
    // OR anyone who has referrals, even if they were referred (they will appear in tree)
    // BUT for the top level list, we only want those who started the chain OR are isolated
    
    // Correction: We want to show the full forest.
    // Roots are users who are NOT in referredIds.
    // But we only care about roots that have children (referrers) to avoid cluttering with single users?
    // User request: "wyswietlali sie uzytkownicy zaproszeni przez innego uzytkownika".
    // Showing everyone might be too much. Let's show users who have children (referrers) AND are not referred by anyone in the current set.
    // OR just show everyone who is a root of a referral tree.

    let rootUsers = [];
    
    Object.values(profileMap).forEach(p => {
      // If user is not referred by anyone (is a root) AND has children
      if (!referredIds.has(p.id) && p.children.length > 0) {
        rootUsers.push(p);
      }
    });

    // Fallback: If user has children but IS referred, they are shown under their parent.
    // But what if the parent is missing? (shouldn't happen with profileMap)
    
    // If no roots found but we have referrals (circular or broken?), just show top referrers
    if (rootUsers.length === 0 && referrals?.length > 0) {
      // Fallback to sorting by children count
      rootUsers = Object.values(profileMap)
        .filter(p => p.children.length > 0)
        .sort((a, b) => b.children.length - a.children.length);
    } else {
       // Sort roots by children count desc
       rootUsers.sort((a, b) => b.children.length - a.children.length);
    }

    // Store for expand/collapse all
    referralTreeData = rootUsers;

    // Render function
    function renderTree() {
      if (rootUsers.length === 0) {
        container.innerHTML = `
          <div class="text-center py-5">
            <p class="text-muted mb-2">No referral connections found.</p>
            <small class="text-secondary">Referrals table is empty or no relationships detected.</small>
          </div>`;
        return;
      }
      container.innerHTML = rootUsers.map(r => renderNode(r, 0)).join('');
      attachTreeListeners();
    }

    // Render single node
    function renderNode(node, level = 0) {
      const hasChildren = node.children?.length > 0;
      const childCount = node.children.length;
      
      // Toggle icon
      const toggleIcon = hasChildren 
        ? `<span class="tree-toggle-icon">${node.expanded ? '−' : '+'}</span>` 
        : '';
      
      // Status badge
      const statusBadge = node.referral_status 
        ? `<span class="status-dot status-${node.referral_status}" title="${node.referral_status}"></span>` 
        : '';

      // Format date
      const dateStr = node.referral_date || node.created_at;
      const dateDisplay = dateStr 
        ? new Date(dateStr).toLocaleDateString('pl-PL') 
        : '';
      
      // Avatar or placeholder
      const avatarHtml = node.avatar_url 
        ? `<img src="${node.avatar_url}" class="tree-avatar" alt="av" onerror="this.src='https://ui-avatars.com/api/?name=${node.username}&background=random'"/>`
        : `<div class="tree-avatar-placeholder">${(node.username || '?').charAt(0).toUpperCase()}</div>`;

      let html = `
        <div class="tree-item" data-node-id="${node.id}" data-level="${level}">
          <div class="tree-row ${hasChildren ? 'tree-row-parent' : ''} ${level === 0 ? 'tree-row-root' : ''}" 
               style="padding-left: ${level * 24 + 12}px;">
            
            <div class="tree-connector">
               <span class="tree-toggle ${hasChildren ? 'tree-toggle-active' : ''}" data-toggle-id="${node.id}">
                 ${toggleIcon}
               </span>
            </div>

            <div class="tree-content">
              <div class="tree-user-card">
                ${avatarHtml}
                <div class="tree-user-details">
                  <div class="tree-user-header">
                    <strong class="tree-username">${node.username || node.name || 'Unknown'}</strong>
                    ${statusBadge}
                    ${childCount > 0 ? `<span class="badge-referrals">${childCount} refs</span>` : ''}
                  </div>
                  <div class="tree-user-meta">
                    <span class="tree-email">${node.email || 'No email'}</span>
                    <span class="tree-date">• ${dateDisplay}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="tree-children-container" data-children-of="${node.id}" 
               style="display: ${node.expanded ? 'block' : 'none'};">
            ${hasChildren && node.expanded ? node.children.map(child => renderNode(child, level + 1)).join('') : ''}
          </div>
        </div>
      `;
      
      return html;
    }

    // Attach click listeners
    function attachTreeListeners() {
      // Toggle buttons
      container.querySelectorAll('.tree-toggle-active').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
          e.stopPropagation();
          const nodeId = this.getAttribute('data-toggle-id');
          toggleNode(nodeId);
        });
      });
      
      // Row clicks
      container.querySelectorAll('.tree-row-parent').forEach(row => {
        row.addEventListener('click', function(e) {
          if (e.target.closest('.tree-toggle')) return; // Don't double trigger
          const item = this.closest('.tree-item');
          const nodeId = item?.getAttribute('data-node-id');
          if (nodeId) toggleNode(nodeId);
        });
      });
    }

    // Toggle node expand/collapse
    function toggleNode(nodeId) {
      const node = findNode(rootUsers, nodeId);
      if (!node || !node.children?.length) return;
      
      node.expanded = !node.expanded;
      
      // Update DOM
      const childrenContainer = container.querySelector(`[data-children-of="${nodeId}"]`);
      const toggleEl = container.querySelector(`[data-toggle-id="${nodeId}"] .tree-toggle-icon`);
      
      if (childrenContainer) {
        if (node.expanded) {
          // Render children
          childrenContainer.innerHTML = node.children.map(child => {
            const level = parseInt(childrenContainer.closest('.tree-item').getAttribute('data-level')) + 1;
            return renderNode(child, level);
          }).join('');
          childrenContainer.style.display = 'block';
          if (toggleEl) toggleEl.textContent = '−';
          attachTreeListeners(); // Re-attach for new elements
        } else {
          childrenContainer.style.display = 'none';
          if (toggleEl) toggleEl.textContent = '+';
        }
      }
    }

    // Find node helper
    function findNode(nodes, id) {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children?.length) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    // Expand/Collapse All helpers
    window.expandAllTreeNodes = function() {
      const setExpanded = (nodes, state) => {
        nodes.forEach(n => {
          if (n.children.length) {
            n.expanded = state;
            setExpanded(n.children, state);
          }
        });
      };
      setExpanded(rootUsers, true);
      renderTree();
    };

    window.collapseAllTreeNodes = function() {
      const setExpanded = (nodes, state) => {
        nodes.forEach(n => {
          n.expanded = state;
          if (n.children.length) setExpanded(n.children, state);
        });
      };
      setExpanded(rootUsers, false);
      renderTree();
    };
    
    // Search helper
    window.searchInTree = function(query) {
      if (!query?.trim()) {
        renderTree();
        return;
      }
      query = query.toLowerCase().trim();
      
      // Reset all expanded first? No, keep context.
      
      let foundAny = false;
      // Recursive search and expand path
      const searchAndExpand = (nodes) => {
        let hasMatch = false;
        nodes.forEach(node => {
          const match = (node.username || '').toLowerCase().includes(query) || 
                        (node.email || '').toLowerCase().includes(query);
          
          let childMatch = false;
          if (node.children.length) {
            childMatch = searchAndExpand(node.children);
          }
          
          if (match || childMatch) {
            node.expanded = true; // Expand if self matches or child matches
            hasMatch = true;
            foundAny = true;
          }
        });
        return hasMatch;
      };
      
      searchAndExpand(rootUsers);
      renderTree();
      
      // Highlight
      setTimeout(() => {
        container.querySelectorAll('.tree-username').forEach(el => {
          if (el.textContent.toLowerCase().includes(query)) {
             el.closest('.tree-user-card').classList.add('highlight-match');
          }
        });
      }, 50);
    };

    // Initial render
    renderTree();

    // Re-bind buttons
    const btnExpandAll = document.getElementById('btnExpandAll');
    const btnCollapseAll = document.getElementById('btnCollapseAll');
    const treeSearch = document.getElementById('treeSearch');
    
    if (btnExpandAll) btnExpandAll.onclick = () => window.expandAllTreeNodes();
    if (btnCollapseAll) btnCollapseAll.onclick = () => window.collapseAllTreeNodes();
    if (treeSearch) {
      let t;
      treeSearch.oninput = (e) => {
        clearTimeout(t);
        t = setTimeout(() => window.searchInTree(e.target.value), 300);
      };
    }

  } catch (e) {
    console.error('Failed to load referral tree:', e);
    const container = document.getElementById('referralTreeContainer');
    if (container) container.innerHTML = `<p class="text-danger">Error loading tree: ${e.message}</p>`;
  }
}

// Initialize referrals tab handling
document.addEventListener('DOMContentLoaded', () => {
  // Referral tab switching
  const referralTabs = document.querySelectorAll('#referralTabs .admin-tab');
  referralTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      
      // Update tab buttons
      referralTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Show/hide content
      document.getElementById('tabReferralSettings').hidden = (tabName !== 'referralSettings');
      document.getElementById('tabReferralList').hidden = (tabName !== 'referralList');
      document.getElementById('tabReferralTree').hidden = (tabName !== 'referralTree');
      document.getElementById('tabReferralStats').hidden = (tabName !== 'referralStats');
      
      // Load data for tab
      if (tabName === 'referralList') loadReferralsData();
      if (tabName === 'referralTree') loadReferralTree();
      if (tabName === 'referralStats') loadReferralStats();
      if (tabName === 'referralSettings') loadReferralSettings();
    });
  });

  // Save XP button
  const btnSaveXp = document.getElementById('btnSaveReferralXp');
  if (btnSaveXp) {
    btnSaveXp.addEventListener('click', saveReferralXpSettings);
  }

  // Refresh button
  const btnRefresh = document.getElementById('btnRefreshReferrals');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadReferralsData);
  }

  // Search and filter
  const referralSearch = document.getElementById('referralSearch');
  if (referralSearch) {
    referralSearch.addEventListener('input', () => {
      referralCurrentPage = 1;
      renderReferralsTable();
    });
  }

  const statusFilter = document.getElementById('referralStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      referralCurrentPage = 1;
      renderReferralsTable();
    });
  }

  // Pagination
  const btnPrev = document.getElementById('btnReferralsPrev');
  const btnNext = document.getElementById('btnReferralsNext');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (referralCurrentPage > 1) {
        referralCurrentPage--;
        renderReferralsTable();
      }
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      referralCurrentPage++;
      renderReferralsTable();
    });
  }

  // Tree controls
  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');
  if (btnExpandAll) {
    btnExpandAll.addEventListener('click', () => {
      document.querySelectorAll('.tree-node').forEach(n => n.style.display = 'flex');
    });
  }
  if (btnCollapseAll) {
    btnCollapseAll.addEventListener('click', () => {
      document.querySelectorAll('.tree-node').forEach((n, i) => {
        if (i > 0) n.style.display = 'none';
      });
    });
  }
});

// Load referrals when view becomes active
window.loadReferralsPanel = function() {
  loadReferralSettings();
  loadReferralsData();
  loadReferralStats();
};

// Export
window.loadReferralSettings = loadReferralSettings;
window.loadReferralsData = loadReferralsData;
window.loadReferralStats = loadReferralStats;
window.loadReferralTree = loadReferralTree;
