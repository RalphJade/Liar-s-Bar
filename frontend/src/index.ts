import { initializeRouter } from './router/router.ts';
import { checkUserStatus } from './auth/auth.ts';
import './styles/main.css'; 

/**
 * Main application entry point.
 */
const main = async () => {
  await checkUserStatus();
  initializeRouter();
};

main();
