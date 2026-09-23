import { useHomePageQuery } from '../api/useHomePageQuery';

export function useHomeContent() {
    const { data, isLoading, isError } = useHomePageQuery();
    return { data, isLoading, isError };
}
