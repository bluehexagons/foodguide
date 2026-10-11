/**
 * Auto-import all built-in locale modules so they self-register with
 * `strings.js`. Importing this module is enough to make every locale
 * appear in `listLocales()`.
 *
 * Note: each locale calls `registerLocale()` at module evaluation time;
 * there is no exported value here. Add new locales by creating a sibling
 * file and importing it below.
 */

import './es.js';
import './zh.js';
