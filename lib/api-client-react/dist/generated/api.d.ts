import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { ApiError, HealthStatus, TrashAnalysisInput, TrashAnalysisResult, TrashAnalysisSummary, TrashStats } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getAnalyzeTrashUrl: () => string;
/**
 * Analyzes an image for trash items, classifies them, and provides handling guidance
 * @summary Analyze trash image
 */
export declare const analyzeTrash: (trashAnalysisInput: TrashAnalysisInput, options?: RequestInit) => Promise<TrashAnalysisResult>;
export declare const getAnalyzeTrashMutationOptions: <TError = ErrorType<ApiError>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof analyzeTrash>>, TError, {
        data: BodyType<TrashAnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof analyzeTrash>>, TError, {
    data: BodyType<TrashAnalysisInput>;
}, TContext>;
export type AnalyzeTrashMutationResult = NonNullable<Awaited<ReturnType<typeof analyzeTrash>>>;
export type AnalyzeTrashMutationBody = BodyType<TrashAnalysisInput>;
export type AnalyzeTrashMutationError = ErrorType<ApiError>;
/**
* @summary Analyze trash image
*/
export declare const useAnalyzeTrash: <TError = ErrorType<ApiError>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof analyzeTrash>>, TError, {
        data: BodyType<TrashAnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof analyzeTrash>>, TError, {
    data: BodyType<TrashAnalysisInput>;
}, TContext>;
export declare const getGetTrashHistoryUrl: () => string;
/**
 * Returns recent trash analysis sessions
 * @summary Get analysis history
 */
export declare const getTrashHistory: (options?: RequestInit) => Promise<TrashAnalysisSummary[]>;
export declare const getGetTrashHistoryQueryKey: () => readonly ["/api/trash/history"];
export declare const getGetTrashHistoryQueryOptions: <TData = Awaited<ReturnType<typeof getTrashHistory>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTrashHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTrashHistory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTrashHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof getTrashHistory>>>;
export type GetTrashHistoryQueryError = ErrorType<unknown>;
/**
 * @summary Get analysis history
 */
export declare function useGetTrashHistory<TData = Awaited<ReturnType<typeof getTrashHistory>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTrashHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetTrashAnalysisUrl: (id: number) => string;
/**
 * Returns full details of a specific trash analysis
 * @summary Get a specific analysis
 */
export declare const getTrashAnalysis: (id: number, options?: RequestInit) => Promise<TrashAnalysisResult>;
export declare const getGetTrashAnalysisQueryKey: (id: number) => readonly [`/api/trash/history/${number}`];
export declare const getGetTrashAnalysisQueryOptions: <TData = Awaited<ReturnType<typeof getTrashAnalysis>>, TError = ErrorType<ApiError>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTrashAnalysis>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTrashAnalysis>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTrashAnalysisQueryResult = NonNullable<Awaited<ReturnType<typeof getTrashAnalysis>>>;
export type GetTrashAnalysisQueryError = ErrorType<ApiError>;
/**
 * @summary Get a specific analysis
 */
export declare function useGetTrashAnalysis<TData = Awaited<ReturnType<typeof getTrashAnalysis>>, TError = ErrorType<ApiError>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTrashAnalysis>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetTrashStatsUrl: () => string;
/**
 * Returns aggregate statistics across all analyses
 * @summary Get trash statistics
 */
export declare const getTrashStats: (options?: RequestInit) => Promise<TrashStats>;
export declare const getGetTrashStatsQueryKey: () => readonly ["/api/trash/stats"];
export declare const getGetTrashStatsQueryOptions: <TData = Awaited<ReturnType<typeof getTrashStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTrashStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTrashStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTrashStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getTrashStats>>>;
export type GetTrashStatsQueryError = ErrorType<unknown>;
/**
 * @summary Get trash statistics
 */
export declare function useGetTrashStats<TData = Awaited<ReturnType<typeof getTrashStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTrashStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map