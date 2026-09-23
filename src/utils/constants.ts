// src/utils/baseUrl.ts

let BASE_URL: string;

const DEV_URL = 'http://192.168.1.26:8000/api';
// const PROD_URL = 'https://backend-prod-254015706580.asia-south2.run.app/api/';
const PROD_URL = 'https://prodlmsbackend-254015706580.asia-south1.run.app/api/';

const savedMode = localStorage.getItem('app_mode');
if (savedMode === 'production') {
  BASE_URL = PROD_URL;
} else {
  BASE_URL = DEV_URL;
}



export const changeMode = (isProd: boolean, reload: boolean = true): void => {
  localStorage.setItem('app_mode', isProd ? 'production' : 'development');
  BASE_URL = isProd ? PROD_URL : DEV_URL;
  if (reload) {
    window.location.reload();
  }
};

export const getBaseUrl = (): string => BASE_URL;
export { BASE_URL };
