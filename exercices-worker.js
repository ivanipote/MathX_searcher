/**
 * ExercicesWorker - WebWorker for background indexing and searching
 * Handles indexing of exercise data and efficient search operations
 * without blocking the main thread
 */

// In-memory index for exercises
let exerciseIndex = {
  byId: {},           // Quick lookup by ID
  byTitle: {},        // Index by title
  byCategory: {},     // Index by category
  byDifficulty: {},   // Index by difficulty level
  byTags: {},         // Index by tags
  fullText: []        // Full-text search index
};

// Configuration
const CONFIG = {
  maxResults: 100,
  enableFuzzySearch: true,
  minSearchLength: 1,
  debounceMs: 300
};

/**
 * Initialize the worker and set up message listener
 */
self.onmessage = function(event) {
  const { action, payload } = event.data;

  try {
    switch(action) {
      case 'INDEX_EXERCISES':
        handleIndexExercises(payload);
        break;
      case 'SEARCH':
        handleSearch(payload);
        break;
      case 'SEARCH_BY_CATEGORY':
        handleSearchByCategory(payload);
        break;
      case 'SEARCH_BY_DIFFICULTY':
        handleSearchByDifficulty(payload);
        break;
      case 'SEARCH_BY_TAGS':
        handleSearchByTags(payload);
        break;
      case 'GET_EXERCISE':
        handleGetExercise(payload);
        break;
      case 'GET_STATISTICS':
        handleGetStatistics(payload);
        break;
      case 'CLEAR_INDEX':
        handleClearIndex();
        break;
      case 'UPDATE_EXERCISE':
        handleUpdateExercise(payload);
        break;
      default:
        sendError(`Unknown action: ${action}`);
    }
  } catch(error) {
    sendError(`Error processing action ${action}: ${error.message}`);
  }
};

/**
 * Index exercises for fast searching
 * @param {Array} exercises - Array of exercise objects to index
 */
function handleIndexExercises(exercises) {
  if (!Array.isArray(exercises)) {
    sendError('Exercises must be an array');
    return;
  }

  const startTime = performance.now();
  let indexedCount = 0;

  exercises.forEach(exercise => {
    if (exercise.id) {
      // Index by ID
      exerciseIndex.byId[exercise.id] = exercise;

      // Index by title
      if (exercise.title) {
        const titleLower = exercise.title.toLowerCase();
        if (!exerciseIndex.byTitle[titleLower]) {
          exerciseIndex.byTitle[titleLower] = [];
        }
        exerciseIndex.byTitle[titleLower].push(exercise.id);
      }

      // Index by category
      if (exercise.category) {
        if (!exerciseIndex.byCategory[exercise.category]) {
          exerciseIndex.byCategory[exercise.category] = [];
        }
        exerciseIndex.byCategory[exercise.category].push(exercise.id);
      }

      // Index by difficulty
      if (exercise.difficulty) {
        if (!exerciseIndex.byDifficulty[exercise.difficulty]) {
          exerciseIndex.byDifficulty[exercise.difficulty] = [];
        }
        exerciseIndex.byDifficulty[exercise.difficulty].push(exercise.id);
      }

      // Index by tags
      if (Array.isArray(exercise.tags)) {
        exercise.tags.forEach(tag => {
          if (!exerciseIndex.byTags[tag]) {
            exerciseIndex.byTags[tag] = [];
          }
          exerciseIndex.byTags[tag].push(exercise.id);
        });
      }

      // Full-text index
      exerciseIndex.fullText.push({
        id: exercise.id,
        text: buildSearchText(exercise)
      });

      indexedCount++;
    }
  });

  const duration = performance.now() - startTime;

  sendSuccess('INDEX_EXERCISES_COMPLETE', {
    indexedCount,
    duration: Math.round(duration),
    totalExercises: Object.keys(exerciseIndex.byId).length
  });
}

/**
 * Build searchable text from exercise object
 * @param {Object} exercise - Exercise object
 * @returns {string} Searchable text
 */
function buildSearchText(exercise) {
  const parts = [
    exercise.title || '',
    exercise.description || '',
    exercise.category || '',
    exercise.difficulty || '',
    (exercise.tags || []).join(' '),
    exercise.content || ''
  ];
  return parts.join(' ').toLowerCase();
}

/**
 * Handle full-text search
 * @param {Object} params - Search parameters { query, limit }
 */
function handleSearch(params) {
  const { query, limit = CONFIG.maxResults } = params;

  if (!query || query.length < CONFIG.minSearchLength) {
    sendSuccess('SEARCH_COMPLETE', { results: [], query, totalResults: 0 });
    return;
  }

  const queryLower = query.toLowerCase();
  const results = [];
  const resultIds = new Set();

  // Search in full-text index
  exerciseIndex.fullText.forEach(entry => {
    if (entry.text.includes(queryLower)) {
      const exercise = exerciseIndex.byId[entry.id];
      if (exercise && !resultIds.has(entry.id)) {
        results.push({
          exercise,
          matchType: 'fullText',
          relevance: calculateRelevance(exercise, queryLower)
        });
        resultIds.add(entry.id);
      }
    }
  });

  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);

  // Limit results
  const limitedResults = results.slice(0, limit).map(r => r.exercise);

  sendSuccess('SEARCH_COMPLETE', {
    results: limitedResults,
    query,
    totalResults: results.length
  });
}

/**
 * Calculate relevance score for search results
 * @param {Object} exercise - Exercise object
 * @param {string} query - Search query
 * @returns {number} Relevance score
 */
function calculateRelevance(exercise, query) {
  let score = 0;

  // Title match (highest priority)
  if (exercise.title && exercise.title.toLowerCase().includes(query)) {
    score += 100;
    if (exercise.title.toLowerCase().startsWith(query)) {
      score += 50;
    }
  }

  // Category match
  if (exercise.category && exercise.category.toLowerCase().includes(query)) {
    score += 20;
  }

  // Tags match
  if (Array.isArray(exercise.tags)) {
    exercise.tags.forEach(tag => {
      if (tag.toLowerCase().includes(query)) {
        score += 15;
      }
    });
  }

  // Description match
  if (exercise.description && exercise.description.toLowerCase().includes(query)) {
    score += 10;
  }

  return score;
}

/**
 * Handle category search
 * @param {Object} params - { category, limit }
 */
function handleSearchByCategory(params) {
  const { category, limit = CONFIG.maxResults } = params;

  const exerciseIds = exerciseIndex.byCategory[category] || [];
  const results = exerciseIds
    .slice(0, limit)
    .map(id => exerciseIndex.byId[id])
    .filter(Boolean);

  sendSuccess('SEARCH_BY_CATEGORY_COMPLETE', {
    results,
    category,
    totalResults: exerciseIds.length
  });
}

/**
 * Handle difficulty level search
 * @param {Object} params - { difficulty, limit }
 */
function handleSearchByDifficulty(params) {
  const { difficulty, limit = CONFIG.maxResults } = params;

  const exerciseIds = exerciseIndex.byDifficulty[difficulty] || [];
  const results = exerciseIds
    .slice(0, limit)
    .map(id => exerciseIndex.byId[id])
    .filter(Boolean);

  sendSuccess('SEARCH_BY_DIFFICULTY_COMPLETE', {
    results,
    difficulty,
    totalResults: exerciseIds.length
  });
}

/**
 * Handle tag-based search
 * @param {Object} params - { tags, matchAll, limit }
 */
function handleSearchByTags(params) {
  const { tags = [], matchAll = false, limit = CONFIG.maxResults } = params;

  if (!Array.isArray(tags) || tags.length === 0) {
    sendSuccess('SEARCH_BY_TAGS_COMPLETE', { results: [], tags, totalResults: 0 });
    return;
  }

  let resultIds;

  if (matchAll) {
    // Get exercises that have ALL tags
    resultIds = tags.reduce((acc, tag) => {
      const tagIds = new Set(exerciseIndex.byTags[tag] || []);
      return acc.filter(id => tagIds.has(id));
    }, Object.keys(exerciseIndex.byId));
  } else {
    // Get exercises that have ANY of the tags
    resultIds = [];
    const resultSet = new Set();
    tags.forEach(tag => {
      (exerciseIndex.byTags[tag] || []).forEach(id => {
        if (!resultSet.has(id)) {
          resultIds.push(id);
          resultSet.add(id);
        }
      });
    });
  }

  const results = resultIds
    .slice(0, limit)
    .map(id => exerciseIndex.byId[id])
    .filter(Boolean);

  sendSuccess('SEARCH_BY_TAGS_COMPLETE', {
    results,
    tags,
    totalResults: resultIds.length
  });
}

/**
 * Get a single exercise by ID
 * @param {Object} params - { id }
 */
function handleGetExercise(params) {
  const { id } = params;
  const exercise = exerciseIndex.byId[id];

  sendSuccess('GET_EXERCISE_COMPLETE', {
    exercise: exercise || null,
    found: !!exercise
  });
}

/**
 * Get indexing statistics
 */
function handleGetStatistics() {
  const stats = {
    totalExercises: Object.keys(exerciseIndex.byId).length,
    categories: Object.keys(exerciseIndex.byCategory).length,
    difficulties: Object.keys(exerciseIndex.byDifficulty).length,
    tags: Object.keys(exerciseIndex.byTags).length,
    categoriesBreakdown: {},
    difficultiesBreakdown: {},
    tagsBreakdown: {}
  };

  // Count exercises per category
  Object.keys(exerciseIndex.byCategory).forEach(cat => {
    stats.categoriesBreakdown[cat] = exerciseIndex.byCategory[cat].length;
  });

  // Count exercises per difficulty
  Object.keys(exerciseIndex.byDifficulty).forEach(diff => {
    stats.difficultiesBreakdown[diff] = exerciseIndex.byDifficulty[diff].length;
  });

  // Count exercises per tag
  Object.keys(exerciseIndex.byTags).forEach(tag => {
    stats.tagsBreakdown[tag] = exerciseIndex.byTags[tag].length;
  });

  sendSuccess('STATISTICS_COMPLETE', stats);
}

/**
 * Clear all indices
 */
function handleClearIndex() {
  exerciseIndex = {
    byId: {},
    byTitle: {},
    byCategory: {},
    byDifficulty: {},
    byTags: {},
    fullText: []
  };

  sendSuccess('CLEAR_INDEX_COMPLETE', {
    message: 'Index cleared successfully'
  });
}

/**
 * Update or add a single exercise
 * @param {Object} params - { exercise }
 */
function handleUpdateExercise(params) {
  const { exercise } = params;

  if (!exercise || !exercise.id) {
    sendError('Exercise must have an id');
    return;
  }

  // Remove old exercise from indices if exists
  if (exerciseIndex.byId[exercise.id]) {
    removeExerciseFromIndices(exercise.id);
  }

  // Add new exercise
  exerciseIndex.byId[exercise.id] = exercise;

  // Re-index
  if (exercise.title) {
    const titleLower = exercise.title.toLowerCase();
    if (!exerciseIndex.byTitle[titleLower]) {
      exerciseIndex.byTitle[titleLower] = [];
    }
    if (!exerciseIndex.byTitle[titleLower].includes(exercise.id)) {
      exerciseIndex.byTitle[titleLower].push(exercise.id);
    }
  }

  if (exercise.category) {
    if (!exerciseIndex.byCategory[exercise.category]) {
      exerciseIndex.byCategory[exercise.category] = [];
    }
    if (!exerciseIndex.byCategory[exercise.category].includes(exercise.id)) {
      exerciseIndex.byCategory[exercise.category].push(exercise.id);
    }
  }

  if (exercise.difficulty) {
    if (!exerciseIndex.byDifficulty[exercise.difficulty]) {
      exerciseIndex.byDifficulty[exercise.difficulty] = [];
    }
    if (!exerciseIndex.byDifficulty[exercise.difficulty].includes(exercise.id)) {
      exerciseIndex.byDifficulty[exercise.difficulty].push(exercise.id);
    }
  }

  if (Array.isArray(exercise.tags)) {
    exercise.tags.forEach(tag => {
      if (!exerciseIndex.byTags[tag]) {
        exerciseIndex.byTags[tag] = [];
      }
      if (!exerciseIndex.byTags[tag].includes(exercise.id)) {
        exerciseIndex.byTags[tag].push(exercise.id);
      }
    });
  }

  // Update full-text index
  const textIndex = exerciseIndex.fullText.find(e => e.id === exercise.id);
  if (textIndex) {
    textIndex.text = buildSearchText(exercise);
  } else {
    exerciseIndex.fullText.push({
      id: exercise.id,
      text: buildSearchText(exercise)
    });
  }

  sendSuccess('UPDATE_EXERCISE_COMPLETE', {
    exerciseId: exercise.id,
    updated: true
  });
}

/**
 * Remove exercise from all indices
 * @param {string} exerciseId - Exercise ID to remove
 */
function removeExerciseFromIndices(exerciseId) {
  const exercise = exerciseIndex.byId[exerciseId];

  if (!exercise) return;

  // Remove from title index
  if (exercise.title) {
    const titleLower = exercise.title.toLowerCase();
    exerciseIndex.byTitle[titleLower] = (exerciseIndex.byTitle[titleLower] || [])
      .filter(id => id !== exerciseId);
  }

  // Remove from category index
  if (exercise.category) {
    exerciseIndex.byCategory[exercise.category] = (exerciseIndex.byCategory[exercise.category] || [])
      .filter(id => id !== exerciseId);
  }

  // Remove from difficulty index
  if (exercise.difficulty) {
    exerciseIndex.byDifficulty[exercise.difficulty] = (exerciseIndex.byDifficulty[exercise.difficulty] || [])
      .filter(id => id !== exerciseId);
  }

  // Remove from tags index
  if (Array.isArray(exercise.tags)) {
    exercise.tags.forEach(tag => {
      if (exerciseIndex.byTags[tag]) {
        exerciseIndex.byTags[tag] = exerciseIndex.byTags[tag].filter(id => id !== exerciseId);
      }
    });
  }

  // Remove from full-text index
  exerciseIndex.fullText = exerciseIndex.fullText.filter(e => e.id !== exerciseId);
}

/**
 * Send success response to main thread
 * @param {string} action - Action name
 * @param {Object} data - Response data
 */
function sendSuccess(action, data) {
  self.postMessage({
    success: true,
    action,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Send error response to main thread
 * @param {string} message - Error message
 */
function sendError(message) {
  self.postMessage({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
}
