import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({
  // 使用 Next.js 代理，避免 CORS 问题
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
});

// 添加请求拦截器，可以在这里添加 token 等
AXIOS_INSTANCE.interceptors.request.use(
  (config) => {
    // 从 localStorage 或其他地方获取 token
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 添加响应拦截器，可以在这里处理错误
AXIOS_INSTANCE.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 统一处理错误，比如 401 跳转到登录页
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// orval 会使用这个函数作为自定义实例
export const customInstance = <T>(
  url: string,
  config: AxiosRequestConfig = {},
): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    url,
    ...config,
    cancelToken: source.token,
  }).then(({ data, status, headers }) => {
    return { data, status, headers } as unknown as T;
  });

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};

export default customInstance;
