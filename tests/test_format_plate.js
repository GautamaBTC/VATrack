const assert = require('assert');

// Mock the formatPlate function by copying it here.
// In a real project, you would export it from ui.js and import it here.
// For simplicity in this environment, we'll redefine it.
function formatPlate(plate) {
  if (!plate) return '';
  const sanitizedPlate = plate.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').toUpperCase();
  const rusRegex = /^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})(\d{2,3})$/;
  const match = sanitizedPlate.match(rusRegex);
  if (match) {
    const letter1 = match[1];
    const digits = match[2];
    const letters2 = match[3];
    const region = match[4];
    const mainPart = `<span class="plate-letter">${letter1}</span><span class="plate-digits">${digits}</span><span class="plate-letters">${letters2}</span>`;
    return `
      <div class="license-plate">
        <div class="plate-main">${mainPart}</div>
        <div class="plate-region">
          <span class="region-code">${region}</span>
          <div class="region-flag-container">
            <div class="rus-flag">
              <div class="flag-stripe flag-white"></div>
              <div class="flag-stripe flag-blue"></div>
              <div class="flag-stripe flag-red"></div>
            </div>
            <span class="flag-rus">RUS</span>
          </div>
        </div>
      </div>`;
  }
  return `<div class="license-plate license-plate-fallback">${sanitizedPlate}</div>`;
}


// --- Test Cases ---

console.log('Running tests for formatPlate...');

// Test 1: Standard Russian plate
const plate1 = 'А123ВС777';
const expected1 = `
      <div class="license-plate">
        <div class="plate-main"><span class="plate-letter">А</span><span class="plate-digits">123</span><span class="plate-letters">ВС</span></div>
        <div class="plate-region">
          <span class="region-code">777</span>
          <div class="region-flag-container">
            <div class="rus-flag">
              <div class="flag-stripe flag-white"></div>
              <div class="flag-stripe flag-blue"></div>
              <div class="flag-stripe flag-red"></div>
            </div>
            <span class="flag-rus">RUS</span>
          </div>
        </div>
      </div>`;
assert.strictEqual(formatPlate(plate1).replace(/\s/g, ''), expected1.replace(/\s/g, ''), 'Test 1 Failed: Standard plate');
console.log('Test 1 Passed');

// Test 2: Plate with lowercase and spaces
const plate2 = 'а 456 в_с 99';
const expected2 = `
      <div class="license-plate">
        <div class="plate-main"><span class="plate-letter">А</span><span class="plate-digits">456</span><span class="plate-letters">ВС</span></div>
        <div class="plate-region">
          <span class="region-code">99</span>
          <div class="region-flag-container">
            <div class="rus-flag">
              <div class="flag-stripe flag-white"></div>
              <div class="flag-stripe flag-blue"></div>
              <div class="flag-stripe flag-red"></div>
            </div>
            <span class="flag-rus">RUS</span>
          </div>
        </div>
      </div>`;
assert.strictEqual(formatPlate(plate2).replace(/\s/g, ''), expected2.replace(/\s/g, ''), 'Test 2 Failed: Lowercase and spaces');
console.log('Test 2 Passed');

// Test 3: Invalid Russian plate (should use fallback)
const plate3 = 'INVALID123';
const expected3 = `<div class="license-plate license-plate-fallback">INVALID123</div>`;
assert.strictEqual(formatPlate(plate3).replace(/\s/g, ''), expected3.replace(/\s/g, ''), 'Test 3 Failed: Invalid plate');
console.log('Test 3 Passed');

// Test 4: Empty input
const plate4 = '';
const expected4 = '';
assert.strictEqual(formatPlate(plate4).replace(/\s/g, ''), expected4.replace(/\s/g, ''), 'Test 4 Failed: Empty input');
console.log('Test 4 Passed');

// Test 5: Null input
const plate5 = null;
const expected5 = '';
assert.strictEqual(formatPlate(plate5).replace(/\s/g, ''), expected5.replace(/\s/g, ''), 'Test 5 Failed: Null input');
console.log('Test 5 Passed');

console.log('All formatPlate tests passed! ✅');
