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
    // 确保 Content-Type 总是被正确设置
    if (!config.headers['Content-Type'] && config.data) {
      config.headers['Content-Type'] = 'application/json';
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 业务错误码定义
export enum BizCode {
  SUCCESS = 200,
  PARAM_ERROR = 4001,
  TOKEN_INVALID = 4003,
  USER_NOT_FOUND = 4004,
  PASSWORD_ERROR = 4005,
  USER_EXISTS = 4006,
}

// 业务错误码对应的错误消息
const BizCodeMessages: Record<number, string> = {
  [BizCode.SUCCESS]: '操作成功',
  [BizCode.PARAM_ERROR]: '参数校验失败',
  [BizCode.TOKEN_INVALID]: 'Token无效',
  [BizCode.USER_NOT_FOUND]: '用户未注册',
  [BizCode.PASSWORD_ERROR]: '密码错误',
  [BizCode.USER_EXISTS]: '用户已存在',
};

// 添加响应拦截器，可以在这里处理错误
AXIOS_INSTANCE.interceptors.response.use(
  (response) => {
    // 检查响应体中的 code 字段（后端使用 code 而不是 error_code）
    const data = response.data;
    if (data && typeof data === 'object' && 'code' in data) {
      const errorCode = data.code as number;
      
      // 如果 code 不是 SUCCESS (200)，则认为是业务错误
      if (errorCode !== BizCode.SUCCESS) {
        const errorMessage = data.message || BizCodeMessages[errorCode] || '请求失败';
        const error: any = new Error(errorMessage);
        error.errorCode = errorCode;
        error.response = {
          data: {
            code: errorCode,
            message: errorMessage,
          },
          status: response.status,
        };
        return Promise.reject(error);
      }
    }
    return response;
  },
  (error) => {
    // 统一处理 HTTP 错误（如 401、500 等）
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
  
  // 将 body 转换为 data（因为生成的代码使用 fetch API 格式，但我们用的是 Axios）
  const axiosConfig: AxiosRequestConfig = { ...config };
  
  // @ts-ignore - 处理生成代码中的 body 字段
  if ('body' in config && config.body) {
    // @ts-ignore
    axiosConfig.data = typeof config.body === 'string' ? JSON.parse(config.body as string) : config.body;
    // @ts-ignore
    delete axiosConfig.body;
  }
  
  const promise = AXIOS_INSTANCE({
    url,
    ...axiosConfig,
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

export type CustomInstance<T> = {
  (url: string, config?: AxiosRequestConfig): Promise<T>;
};

export default customInstance;
