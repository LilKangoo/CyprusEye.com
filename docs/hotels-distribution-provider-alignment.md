# Distribution and external provider alignment

Baseline: 5c214ee494c8d3688114ded708ab3cf523a332d1; reported production boundary 114485.
This task accesses no production system and changes no SQL, RPC, flags or secrets.

## Exact presentation defect

`renderDistributionPanel` in `admin/hotels-v2-workspace.js` hard-coded the H3.1
all-off/inert narrative and labelled any true workspace flag unexpected. It did
not consult the audited capability lifecycle or current external-calendar DTO.
The replacement renders observed flags, confirms the lifecycle using the existing
strict validator, and shows Public booking UNKNOWN if current audit evidence is
missing/inconsistent. A global capability is not a configured or healthy source.
The provider section distinguishes unavailable, empty, URL missing, ready,
blocked and enabled states. It exposes only counts, never URLs or private IDs.
Its sole button navigates to Calendar; it performs no mutation or extra fetch.

## Source contract and real operator input

The current editor and `buildExternalCalendarDraft` require:

* Provider: `booking_com`, `airbnb` or `ical` (Generic iCal is the default
  selection, not the only option supported by the current source).
* Exact active Room mapping; each source belongs to one Hotel and one Room.
* User-defined source code, unique within the Hotel, matching
  `^[a-z0-9][a-z0-9_-]{0,79}$`. Example only: `upper-generic-ical`.
  This is a local source identifier, not a channel credential or provider type.
* Integer sync interval 15–1440 minutes, units per event 1–100 and not exceeding
  the Room's physical capacity, integer priority -32768–32767.
* Review reason, 3–500 characters, for each reviewed operation.
* At the later Set URL stage: the actual Room-specific private HTTPS ICS export
  URL obtained from the Hotel/channel. Never invent an export URL.

Upper and Ground each require a separate source row and separate private URL
binding when both are to be synchronized. Obtain an export for each Room's actual
inventory. There is no URL-string uniqueness rule: do not claim two distinct
strings are required by the schema. Reusing an aggregate feed would import its
events against each configured Room; this contract has no per-event Room filter.

`openExternalCalendarEditor` does not request the URL. Source Review/Save creates
a reviewed but disabled source without a secret. `openExternalCalendarAction`
handles Set URL / Rotate URL / Clear URL with a separate Review and Save.
The URL is temporarily held in the password input/Save closure and transmitted
only through the authorized RPC. Plans/control responses expose fingerprint or
configured-status evidence, not the plaintext URL. Server-side storage is
encrypted Supabase Vault; `hotels_v2_private.hotel_external_calendar_source_secrets`
holds the private source/Room binding, Vault reference, fingerprint and version.

Enable requires a separate Review/Save, global External Calendar ON, reviewed
source, private binding and worker/scheduler readiness. Creating a source or
saving its URL does not enable it. The retained lifecycle supports Disable;
once disabled, Clear URL revokes the Vault secret and binding. Rotate also
requires a disabled source. Active jobs and stale versions fail closed.
There is no source hard-delete operation in this UI contract.

## Generic iCal compatibility limits

All three supported labels use the ICS worker/parser. Generic iCal is suitable
for a standard booking export satisfying that parser, not every possible iCalendar
document. The worker requires UID, DTSTART and DTEND; RRULE/RDATE/EXDATE must be
expanded by the exporter. HTTPS/SSRF restrictions, bounded redirects, 2 MiB
response, 500 events and 366 days per event also apply. It does not provide
channel API authentication or automatically split a property-wide feed by Room.

Evidence: applied 114200 reviewed-control source creation, validation, secret and
enable/disable branches; 114450 provider-type extensions; 113900 private binding
schema; `supabase/functions/hotels-v2-external-calendar-sync/core.ts` normalizer
and network limits. These files remain unchanged.

## Focused local proof

Jest: 23/23 across Distribution presentation and existing Stage2D client contracts.
Chromium: 4/4 including Distribution desktop/mobile, create -> URL -> enable ->
disable -> clear (five distinct Review/Save actions), failed URL Review cleanup,
and redacted Partner proposal decisions. Browser workflow uses synthetic mocks;
no provider, worker, production RPC or Vault operation is executed.
Normal build passes; the one changed Admin dist mirror is verified against the
normal minifier. No migration is required. A local commit is not deployment
authorization; the next human step is review and collection of real Room feeds.
