import { useQuery } from '@tanstack/react-query';
import { getHomePageContent } from '@/pages/home/api/getHomePageContent';

export const homeQueryKeys = {
  pageContent: ['home', 'page-content'] as const,
};

export const useHomePageQuery = () => {
  return useQuery({
    queryKey: homeQueryKeys.pageContent,
    queryFn: getHomePageContent,
  });
};
