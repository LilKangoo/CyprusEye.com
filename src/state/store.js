/**
 * Central State Store
 * Simple pub/sub pattern for state management
 */

class StateStore {
  constructor() {
    this.state = {};
    this.subscribers = new Map();
  }

  /**
   * Get current state or specific key
   * @param {string} key - Optional key to get specific state
   * @returns {*}
   */
  getState(key) {
    if (key) {
      return this.state[key];
    }
    return { ...this.state };
  }

  /**
   * Set state and notify subscribers
   * @param {string} key - State key
   * @param {*} value - New value
   */
  setState(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    
    // Notify subscribers for this key
    this.notify(key, value, oldValue);
  }

  /**
   * Update state with partial object
   * @param {Object} updates - Key-value pairs to update
   */
  updateState(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.setState(key, value);
    });
  }

  /**
   * Subscribe to state changes
   * @param {string} key - State key to watch (or '*' for all)
   * @param {Function} callback - Callback(newValue, oldValue, key)
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  /**
   * Notify subscribers of state change
   * @param {string} key - Changed key
   * @param {*} newValue - New value
   * @param {*} oldValue - Old value
   */
  notify(key, newValue, oldValue) {
    // Notify specific key subscribers
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      keySubscribers.forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error(`Error in subscriber for '${key}':`, error);
        }
      });
    }
    
    // Notify wildcard subscribers
    const wildcardSubscribers = this.subscribers.get('*');
    if (wildcardSubscribers) {
      wildcardSubscribers.forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error(`Error in wildcard subscriber:`, error);
        }
      });
    }
  }

  /**
   * Reset entire state
   */
  reset() {
    const oldState = { ...this.state };
    this.state = {};
    
    // Notify all subscribers
    Object.keys(oldState).forEach(key => {
      this.notify(key, undefined, oldState[key]);
    });
  }

  /**
   * Reset specific key
   * @param {string} key - Key to reset
   */
  resetKey(key) {
    this.setState(key, undefined);
  }

  /**
   * Check if key exists in state
   * @param {string} key - Key to check
   * @returns {boolean}
   */
  has(key) {
    return key in this.state;
  }

  /**
   * Get all state keys
   * @returns {string[]}
   */
  keys() {
    return Object.keys(this.state);
  }

  /**
   * Get state size (number of keys)
   * @returns {number}
   */
  size() {
    return Object.keys(this.state).length;
  }
}

// Create singleton instance
const store = new StateStore();

// Export instance and class
export default store;
export { StateStore };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.__cyprusEyeStore = store;
}
