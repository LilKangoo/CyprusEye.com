(() => {
  const TILE_SIZE = 256;
  const DEG_TO_RAD = Math.PI / 180;
  const EARTH_RADIUS = 6378137;
  const DEFAULT_MIN_ZOOM = 2;
  const DEFAULT_MAX_ZOOM = 18;
  const SUBDOMAINS = ['a', 'b', 'c'];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toLatLng(value) {
    if (Array.isArray(value) && value.length >= 2) {
      return { lat: Number(value[0]) || 0, lng: Number(value[1]) || 0 };
    }
    if (value && typeof value === 'object') {
      return { lat: Number(value.lat) || 0, lng: Number(value.lng) || 0 };
    }
    return { lat: 0, lng: 0 };
  }

  function formatTemplate(template, coords, zoom, subdomains) {
    const tileCount = 1 << zoom;
    const wrappedX = ((coords.x % tileCount) + tileCount) % tileCount;
    const clampedY = clamp(coords.y, 0, tileCount - 1);
    const index = Math.abs(coords.x + coords.y) % subdomains.length;
    const domain = subdomains[index];
    return template
      .replace('{s}', domain)
      .replace('{z}', String(zoom))
      .replace('{x}', String(wrappedX))
      .replace('{y}', String(clampedY));
  }

  function supportsPassiveEvents() {
    let supported = false;
    try {
      const options = Object.defineProperty({}, 'passive', {
        get() {
          supported = true;
          return false;
        },
      });
      window.addEventListener('test', null, options);
      window.removeEventListener('test', null, options);
    } catch (error) {
      supported = false;
    }
    return supported;
  }

  class Evented {
    constructor() {
      this._events = new Map();
    }

    on(type, handler) {
      if (!type || typeof handler !== 'function') {
        return this;
      }
      if (!this._events.has(type)) {
        this._events.set(type, new Set());
      }
      this._events.get(type).add(handler);
      return this;
    }

    off(type, handler) {
      if (!type) {
        return this;
      }
      if (handler) {
        const handlers = this._events.get(type);
        handlers?.delete(handler);
      } else {
        this._events.delete(type);
      }
      return this;
    }

    fire(type, detail = {}) {
      const handlers = this._events.get(type);
      if (!handlers) {
        return this;
      }
      handlers.forEach((handler) => {
        try {
          handler.call(this, { type, target: this, ...detail });
        } catch (error) {
          console.error('Leaflet-lite listener error', error);
        }
      });
      return this;
    }
  }

  class Layer extends Evented {
    constructor() {
      super();
      this._map = null;
    }

    addTo(map) {
      map.addLayer(this);
      return this;
    }

    remove() {
      if (this._map) {
        this._map.removeLayer(this);
      }
      return this;
    }

    _setMap(map) {
      this._map = map;
    }

    _update() {}
  }

  class Map extends Evented {
    constructor(container, options = {}) {
      super();
      const element = typeof container === 'string' ? document.getElementById(container) : container;
      if (!(element instanceof HTMLElement)) {
        throw new Error('Leaflet-lite: invalid map container');
      }

      this._container = element;
      this._options = {
        minZoom: options.minZoom ?? DEFAULT_MIN_ZOOM,
        maxZoom: options.maxZoom ?? DEFAULT_MAX_ZOOM,
      };
      this._layers = new Set();
      this._origin = { x: 0, y: 0 };
      this._center = toLatLng(options.center || [0, 0]);
      this._zoom = clamp(Number(options.zoom) || 0, this._options.minZoom, this._options.maxZoom);
      this._size = { width: this._container.clientWidth, height: this._container.clientHeight };
      this._dragging = false;
      this._pointerStart = null;
      this._startCenter = null;
      this._resizeObserver = null;
      this._tilePane = null;
      this._overlayPane = null;
      this._popupPane = null;
      this._tooltipPane = null;
      this._attributionNode = null;
      this._activePopup = null;
      this._nextZIndex = 1000;

      this._buildPanes();
      this._setupEventHandlers();
      this._renderAttribution(options.attribution);
      this.setView(this._center, this._zoom);
    }

    _buildPanes() {
      this._container.classList.add('leaflet-container');
      this._tilePane = document.createElement('div');
      this._tilePane.className = 'leaflet-tile-pane';
      this._tileContainer = document.createElement('div');
      this._tileContainer.style.position = 'absolute';
      this._tileContainer.style.inset = '0';
      this._tilePane.appendChild(this._tileContainer);

      this._overlayPane = document.createElement('div');
      this._overlayPane.className = 'leaflet-overlay-pane';
      this._popupPane = document.createElement('div');
      this._popupPane.className = 'leaflet-popup-pane';
      this._tooltipPane = document.createElement('div');
      this._tooltipPane.className = 'leaflet-tooltip-pane';

      this._container.appendChild(this._tilePane);
      this._container.appendChild(this._overlayPane);
      this._container.appendChild(this._popupPane);
      this._container.appendChild(this._tooltipPane);
    }

    _setupEventHandlers() {
      const onPointerDown = (event) => {
        if (event.button !== 0) {
          return;
        }
        this._dragging = true;
        this._pointerStart = { x: event.clientX, y: event.clientY };
        this._startCenter = { ...this._center };
        this._container.setPointerCapture(event.pointerId);
      };

      const onPointerMove = (event) => {
        if (!this._dragging || !this._pointerStart || !this._startCenter) {
          return;
        }
        const deltaX = event.clientX - this._pointerStart.x;
        const deltaY = event.clientY - this._pointerStart.y;
        const startProjected = this._project(this._startCenter, this._zoom);
        const scale = 1 << this._zoom;
        const newProjected = {
          x: startProjected.x - deltaX,
          y: startProjected.y - deltaY,
        };
        const newCenter = this._unproject(newProjected, this._zoom);
        this._center = newCenter;
        this._updateView();
      };

      const onPointerUp = (event) => {
        if (!this._dragging) {
          return;
        }
        this._dragging = false;
        this._pointerStart = null;
        this._startCenter = null;
        try {
          this._container.releasePointerCapture(event.pointerId);
        } catch (error) {
          // ignore
        }
      };

      const onWheel = (event) => {
        event.preventDefault();
        const delta = event.deltaY;
        if (!Number.isFinite(delta) || delta === 0) {
          return;
        }
        const direction = delta > 0 ? -1 : 1;
        const targetZoom = clamp(this._zoom + direction, this._options.minZoom, this._options.maxZoom);
        if (targetZoom === this._zoom) {
          return;
        }

        const rect = this._container.getBoundingClientRect();
        const offsetPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const focusLatLng = this.layerPointToLatLng(offsetPoint);
        this._zoom = targetZoom;
        this._center = focusLatLng;
        this._updateView();
      };

      this._container.addEventListener('pointerdown', onPointerDown);
      this._container.addEventListener('pointermove', onPointerMove);
      this._container.addEventListener('pointerup', onPointerUp);
      this._container.addEventListener('pointercancel', onPointerUp);
      this._container.addEventListener('wheel', onWheel, supportsPassiveEvents() ? { passive: false } : false);

      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => {
          const newWidth = this._container.clientWidth;
          const newHeight = this._container.clientHeight;
          if (newWidth !== this._size.width || newHeight !== this._size.height) {
            this._size = { width: newWidth, height: newHeight };
            this._updateView();
          }
        });
        this._resizeObserver.observe(this._container);
      }
    }

    _renderAttribution(initial) {
      this._attributionNode = document.createElement('div');
      this._attributionNode.className = 'leaflet-attribution';
      if (initial) {
        this._attributionNode.innerHTML = initial;
      }
      this._container.appendChild(this._attributionNode);
    }

    setView(latlng, zoom, _options = {}) {
      const nextZoom = Number.isFinite(zoom) ? zoom : this._zoom;
      this._zoom = clamp(nextZoom, this._options.minZoom, this._options.maxZoom);
      this._center = toLatLng(latlng);
      this._updateView();
      return this;
    }

    getZoom() {
      return this._zoom;
    }

    addLayer(layer) {
      if (!(layer instanceof Layer) || this._layers.has(layer)) {
        return this;
      }
      layer._setMap(this);
      if (typeof layer.onAdd === 'function') {
        layer.onAdd(this);
      }
      this._layers.add(layer);
      layer._update?.();
      return this;
    }

    removeLayer(layer) {
      if (!this._layers.has(layer)) {
        return this;
      }
      if (typeof layer.onRemove === 'function') {
        layer.onRemove(this);
      }
      this._layers.delete(layer);
      layer._setMap(null);
      return this;
    }

    invalidateSize() {
      this._size = { width: this._container.clientWidth, height: this._container.clientHeight };
      this._updateView();
      return this;
    }

    project(latlng, zoom = this._zoom) {
      return this._project(toLatLng(latlng), zoom);
    }

    unproject(point, zoom = this._zoom) {
      return this._unproject(point, zoom);
    }

    latLngToLayerPoint(latlng) {
      const projected = this._project(toLatLng(latlng), this._zoom);
      return {
        x: projected.x - this._origin.x,
        y: projected.y - this._origin.y,
      };
    }

    layerPointToLatLng(point) {
      const absolutePoint = {
        x: point.x + this._origin.x,
        y: point.y + this._origin.y,
      };
      return this._unproject(absolutePoint, this._zoom);
    }

    closePopup() {
      if (this._activePopup) {
        this._activePopup.hide();
        this._activePopup = null;
      }
    }

    _setAttribution(html) {
      if (this._attributionNode) {
        this._attributionNode.innerHTML = html || '';
      }
    }

    _openPopup(popup) {
      if (this._activePopup && this._activePopup !== popup) {
        this._activePopup.hide();
      }
      this._activePopup = popup;
      popup.show();
    }

    _updateView() {
      const size = this._size;
      const centerPoint = this._project(this._center, this._zoom);
      this._origin = {
        x: centerPoint.x - size.width / 2,
        y: centerPoint.y - size.height / 2,
      };
      this._tileContainer.style.transform = `translate(${-this._origin.x}px, ${-this._origin.y}px)`;

      this._layers.forEach((layer) => {
        layer._update?.();
      });
    }

    _project(latlng, zoom) {
      const d = Math.PI / 180;
      const sin = Math.sin(latlng.lat * d);
      const scale = TILE_SIZE * (1 << zoom);
      const x = ((latlng.lng + 180) / 360) * scale;
      const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
      return { x, y };
    }

    _unproject(point, zoom) {
      const scale = TILE_SIZE * (1 << zoom);
      const lng = (point.x / scale) * 360 - 180;
      const y = 0.5 - point.y / scale;
      const lat = (90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI);
      return { lat, lng };
    }
  }

  class TileLayer extends Layer {
    constructor(urlTemplate, options = {}) {
      super();
      this._urlTemplate = urlTemplate;
      this.options = {
        subdomains: options.subdomains || SUBDOMAINS,
        attribution: options.attribution || '',
      };
      this._tiles = new Map();
      this._container = document.createElement('div');
      this._container.style.position = 'absolute';
      this._container.style.inset = '0';
      this._container.style.willChange = 'transform';
      this._currentZoom = null;
    }

    onAdd(map) {
      this._map = map;
      map._tileContainer.appendChild(this._container);
      if (this.options.attribution) {
        map._setAttribution(this.options.attribution);
      }
      this._update();
    }

    onRemove(map) {
      this._tiles.forEach((tile) => {
        tile.el.remove();
      });
      this._tiles.clear();
      this._container.remove();
      if (map && map._attributionNode) {
        map._attributionNode.textContent = '';
      }
    }

    _createTile(x, y, zoom) {
      const img = document.createElement('img');
      img.className = 'leaflet-tile';
      img.alt = '';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.crossOrigin = 'anonymous';
      const url = formatTemplate(this._urlTemplate, { x, y }, zoom, this.options.subdomains);
      img.src = url;
      const tile = { el: img, x, y, zoom };
      this._positionTile(tile, x, y);
      return tile;
    }

    _positionTile(tile, x, y) {
      tile.el.style.transform = `translate(${x * TILE_SIZE}px, ${y * TILE_SIZE}px)`;
    }

    _update() {
      if (!this._map) {
        return;
      }
      const zoom = this._map.getZoom();
      const needsRefresh = this._currentZoom !== zoom;
      if (needsRefresh) {
        this._tiles.forEach((tile) => tile.el.remove());
        this._tiles.clear();
        this._currentZoom = zoom;
      }

      const origin = this._map._origin;
      const size = this._map._size;
      const startX = Math.floor(origin.x / TILE_SIZE) - 1;
      const startY = Math.floor(origin.y / TILE_SIZE) - 1;
      const endX = Math.floor((origin.x + size.width) / TILE_SIZE) + 1;
      const endY = Math.floor((origin.y + size.height) / TILE_SIZE) + 1;
      const zoomTiles = 1 << zoom;
      const needed = new Set();

      for (let tileX = startX; tileX <= endX; tileX += 1) {
        for (let tileY = startY; tileY <= endY; tileY += 1) {
          if (tileY < 0 || tileY >= zoomTiles) {
            continue;
          }
          const key = `${tileX}:${tileY}:${zoom}`;
          needed.add(key);
          if (!this._tiles.has(key)) {
            const tile = this._createTile(tileX, tileY, zoom);
            this._tiles.set(key, tile);
            this._container.appendChild(tile.el);
          } else {
            const tile = this._tiles.get(key);
            this._positionTile(tile, tileX, tileY);
          }
        }
      }

      this._tiles.forEach((tile, key) => {
        if (!needed.has(key)) {
          tile.el.remove();
          this._tiles.delete(key);
        }
      });
    }
  }

  function withInitHooks(Class) {
    Class._initHooks = [];
    Class.addInitHook = function addInitHook(fn) {
      if (typeof fn === 'function') {
        Class._initHooks.push(fn);
      }
      return this;
    };
    Class.include = function include(props) {
      if (props && typeof props === 'object') {
        Object.assign(Class.prototype, props);
      }
      return this;
    };
    Class.prototype._callInitHooks = function callInitHooks() {
      Class._initHooks.forEach((hook) => {
        hook.call(this);
      });
    };
  }

  class Tooltip {
    constructor(layer, content, options = {}) {
      this._layer = layer;
      this._map = layer._map;
      this._content = content;
      this._options = options;
      this._element = document.createElement('div');
      this._element.className = 'leaflet-tooltip';
      this.setContent(content);
      this._visible = false;
      this._map._tooltipPane.appendChild(this._element);
    }

    setContent(content) {
      this._content = content;
      this._element.innerHTML = content;
      this._updatePosition();
      return this;
    }

    _updatePosition() {
      if (!this._layer?._map) {
        return;
      }
      const point = this._layer._map.latLngToLayerPoint(this._layer.getLatLng());
      const offset = Array.isArray(this._options.offset) ? this._options.offset : [0, 0];
      const x = point.x + offset[0];
      const y = point.y + offset[1];
      this._element.style.transform = `translate(${x}px, ${y}px)`;
    }

    show() {
      if (!this._visible) {
        this._element.classList.add('visible');
        this._visible = true;
      }
      this._updatePosition();
    }

    hide() {
      if (this._visible) {
        this._element.classList.remove('visible');
        this._visible = false;
      }
    }

    remove() {
      this._element.remove();
    }
  }

  class Popup {
    constructor(layer, content) {
      this._layer = layer;
      this._map = layer._map;
      this._content = content || '';
      this._element = document.createElement('div');
      this._element.className = 'leaflet-popup hidden';
      this._element.innerHTML = this._content;
      this._map._popupPane.appendChild(this._element);
    }

    setContent(content) {
      this._content = content;
      this._element.innerHTML = content;
      this._updatePosition();
      return this;
    }

    show() {
      this._updatePosition();
      this._element.classList.remove('hidden');
    }

    hide() {
      this._element.classList.add('hidden');
    }

    remove() {
      this._element.remove();
    }

    _updatePosition() {
      if (!this._layer?._map) {
        return;
      }
      const point = this._layer._map.latLngToLayerPoint(this._layer.getLatLng());
      this._element.style.transform = `translate(${point.x}px, ${point.y}px)`;
    }
  }

  class OverlayLayer extends Layer {
    constructor(latlng, options = {}) {
      super();
      this._latlng = toLatLng(latlng);
      this.options = { ...options };
    }

    getLatLng() {
      return this._latlng;
    }

    setLatLng(latlng) {
      this._latlng = toLatLng(latlng);
      this._update();
      return this;
    }
  }

  class Marker extends OverlayLayer {
    constructor(latlng, options = {}) {
      super(latlng, options);
      this._element = document.createElement('div');
      this._element.className = 'leaflet-marker';
      this._popup = null;
      this._popupContent = undefined;
      this._tooltip = null;
      this._zIndex = 1;
      this._element.tabIndex = 0;
      this._callInitHooks();
    }

    onAdd(map) {
      this._map = map;
      map._overlayPane.appendChild(this._element);
      this._element.addEventListener('click', (event) => {
        event.stopPropagation();
        if (this._popup) {
          this.openPopup();
        }
        this.fire('click', { originalEvent: event });
      });
      this._element.addEventListener('mouseenter', () => {
        this._tooltip?.show();
      });
      this._element.addEventListener('mouseleave', () => {
        this._tooltip?.hide();
      });
      if (typeof this._popupContent !== 'undefined') {
        this.bindPopup(this._popupContent);
        this._popupContent = undefined;
      }
      this._update();
    }

    onRemove() {
      this._element.remove();
      this._popup?.remove();
      this._popup = null;
      this._tooltip?.remove();
    }

    bindPopup(content) {
      if (!this._map) {
        this._popupContent = content;
        return this;
      }
      if (this._popup) {
        this._popup.setContent(content);
        return this;
      }
      this._popup = new Popup(this, content);
      return this;
    }

    setPopupContent(content) {
      if (this._popup) {
        this._popup.setContent(content);
      } else {
        this.bindPopup(content);
      }
      return this;
    }

    openPopup() {
      if (!this._popup) {
        this.bindPopup('');
      }
      this._map?._openPopup(this._popup);
      return this;
    }

    bindTooltip(content, options) {
      if (this._tooltip) {
        this._tooltip.setContent(content);
        return this;
      }
      if (!this._map) {
        this._pendingTooltip = { content, options };
        return this;
      }
      this._tooltip = new Tooltip(this, content, options);
      return this;
    }

    getTooltip() {
      return this._tooltip;
    }

    bringToFront() {
      this._zIndex += 10;
      this._element.style.zIndex = String(this._zIndex + this._map._nextZIndex);
      return this;
    }

    bringToBack() {
      this._zIndex = 0;
      this._element.style.zIndex = '1';
      return this;
    }

    _update() {
      if (!this._map) {
        return;
      }
      const point = this._map.latLngToLayerPoint(this._latlng);
      this._element.style.transform = `translate(${point.x}px, ${point.y}px)`;
      this._popup?._updatePosition();
      this._tooltip?._updatePosition();
      if (!this._tooltip && this._pendingTooltip && this._map) {
        const { content, options } = this._pendingTooltip;
        this._tooltip = new Tooltip(this, content, options);
        this._pendingTooltip = null;
      }
    }
  }

  withInitHooks(Marker);

  class CircleMarker extends OverlayLayer {
    constructor(latlng, options = {}) {
      super(latlng, options);
      this._element = document.createElement('div');
      this._element.className = 'leaflet-circle-marker';
      this.options.radius = Number(options.radius) || 8;
      this._applyStrokeOptions();
    }

    onAdd(map) {
      this._map = map;
      map._overlayPane.appendChild(this._element);
      this._update();
    }

    onRemove() {
      this._element.remove();
    }

    setRadius(radius) {
      this.options.radius = Number(radius) || this.options.radius;
      this._update();
      return this;
    }

    bringToFront() {
      this._element.style.zIndex = String(this._map?._nextZIndex ?? 1000);
      return this;
    }

    bringToBack() {
      this._element.style.zIndex = '0';
      return this;
    }

    _applyStrokeOptions() {
      if (this.options.color) {
        this._element.style.borderColor = this.options.color;
      }
      if (this.options.fillColor) {
        this._element.style.backgroundColor = this.options.fillColor;
      }
      if (Number.isFinite(this.options.fillOpacity)) {
        this._element.style.opacity = String(this.options.fillOpacity);
      }
    }

    _update() {
      if (!this._map) {
        return;
      }
      const point = this._map.latLngToLayerPoint(this._latlng);
      const radius = this.options.radius;
      this._element.style.width = `${radius * 2}px`;
      this._element.style.height = `${radius * 2}px`;
      this._element.style.transform = `translate(${point.x - radius}px, ${point.y - radius}px)`;
    }
  }

  class Circle extends CircleMarker {
    constructor(latlng, options = {}) {
      super(latlng, options);
      this._element.className = 'leaflet-circle';
      this._metersRadius = Number(options.radius) || 0;
    }

    setRadius(meters) {
      this._metersRadius = Number(meters) || 0;
      this._update();
      return this;
    }

    _getMetersPerPixel() {
      if (!this._map) {
        return 1;
      }
      const lat = toLatLng(this._latlng).lat;
      const zoom = this._map.getZoom();
      const metersPerPixel =
        (Math.cos(lat * DEG_TO_RAD) * 2 * Math.PI * EARTH_RADIUS) /
        (TILE_SIZE * (1 << zoom));
      return metersPerPixel;
    }

    _update() {
      if (!this._map) {
        return;
      }
      const metersPerPixel = this._getMetersPerPixel();
      const radiusPixels = this._metersRadius / metersPerPixel;
      const point = this._map.latLngToLayerPoint(this._latlng);
      const diameter = radiusPixels * 2;
      this._element.style.width = `${diameter}px`;
      this._element.style.height = `${diameter}px`;
      this._element.style.transform = `translate(${point.x - radiusPixels}px, ${point.y - radiusPixels}px)`;
    }
  }

  const L = {
    map: (container, options) => new Map(container, options),
    tileLayer: (url, options) => new TileLayer(url, options),
    marker: (latlng, options) => new Marker(latlng, options),
    circleMarker: (latlng, options) => new CircleMarker(latlng, options),
    circle: (latlng, options) => new Circle(latlng, options),
    Map,
    TileLayer,
    Marker,
    CircleMarker,
    Circle,
    version: '1.0.0-lite',
  };

  if (typeof window !== 'undefined') {
    window.L = L;
  }
})();
