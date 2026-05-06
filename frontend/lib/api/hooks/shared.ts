import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query'

export type QueryHookOptions<TQueryFnData, TData = TQueryFnData, TError = unknown> = {
  query?: Omit<UseQueryOptions<TQueryFnData, TError, TData>, 'queryKey' | 'queryFn'>
}

export type MutationHookOptions<TData, TVariables, TError = unknown, TContext = unknown> = {
  mutation?: UseMutationOptions<TData, TError, TVariables, TContext>
}
