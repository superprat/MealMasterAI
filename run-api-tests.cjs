#!/usr/bin/env node

const { spawn } = require('child_process');

function runApiTests() {
  console.log('🧪 Running API Tests for Meal Planner Application\n');
  
  const process = spawn('npx', [
    'playwright', 'test', 
    'tests/api.spec.ts', 
    '--project="API Tests"',
    '--reporter=list'
  ], { 
    stdio: 'inherit',
    shell: true 
  });
  
  process.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ All API tests passed! Core functionality is working correctly.');
      console.log('📡 Authentication, recipe management, meal planning, and AI suggestions are all functional.\n');
    } else {
      console.log('\n❌ Some API tests failed. Please check the output above for details.');
      process.exit(1);
    }
  });
  
  process.on('error', (err) => {
    console.error('Error running tests:', err.message);
    process.exit(1);
  });
}

runApiTests();