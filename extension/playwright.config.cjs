const {defineConfig}=require('../frontend/node_modules/@playwright/test');
module.exports=defineConfig({testDir:'./tests',testMatch:'browser.spec.cjs',timeout:45000,workers:1,
  reporter:'list',outputDir:'test-results'});
