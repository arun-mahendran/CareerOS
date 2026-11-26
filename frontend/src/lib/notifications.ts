import { queryOptions, useQuery } from "@tanstack/react-query";
import { notifications, USE_API } from "@/services/backend";

export const notificationsQuery = queryOptions({
  queryKey: ["notifications", "list"],
  queryFn: notifications.list,
  enabled: USE_API,
  staleTime: 0,
  refetchOnWindowFocus: true,
});

export const unreadNotificationsQuery = queryOptions({
  queryKey: ["notifications", "unread"],
  queryFn: notifications.unreadCount,
  enabled: USE_API,
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchInterval: 60_000,
});

export function useUnreadNotifications() {
  return useQuery(unreadNotificationsQuery);
}