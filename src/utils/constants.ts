let BASE_URL: string;

const savedBaseUrl = localStorage.getItem('crm_custom_base_url');
if (savedBaseUrl) {
  BASE_URL = savedBaseUrl;
} else {
  BASE_URL = 'https://crm-server.kcglobed.com/';
}

export const changeBaseUrl = (url: string, reload: boolean = true): void => {
  localStorage.setItem('crm_custom_base_url', url);
  BASE_URL = url;
  if (reload) {
    window.location.reload();
  }
};

export const getBaseUrl = (): string => BASE_URL;
export { BASE_URL };
