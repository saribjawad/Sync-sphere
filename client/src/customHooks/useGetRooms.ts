import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { RoomSchema } from "../schemas/roomSchema";
import { ErrorType } from "../schemas/errorSchema";
import { api } from "../config/axios";
import { useAppDispatch } from "../app/hook";
import { setAllRooms } from "../features/room/room.slice";

const UseGetRoomResponseSchema = z.object({
  statusCode: z.number(),
  data: z.array(RoomSchema),
  message: z.string(),
  success: z.boolean(),
});

type UseGetRoomResponseType = z.infer<typeof UseGetRoomResponseSchema>;

export const useGetRooms = () => {
  const dispatch = useAppDispatch();

  return useQuery<UseGetRoomResponseType, ErrorType>({
    queryKey: ["rooms"],
    queryFn: async (): Promise<UseGetRoomResponseType> => {
      const response = await api.get("/room/get-all-rooms");
      // Validate before updating the store; React Query handles any thrown error.
      const parsedResponse = UseGetRoomResponseSchema.parse(response.data);
      dispatch(setAllRooms(parsedResponse.data));

      return parsedResponse;
    },

    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};
