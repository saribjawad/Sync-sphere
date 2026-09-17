import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { RoomSchema } from "../schemas/roomSchema";
import { ErrorType } from "../schemas/errorSchema";
import { api } from "../config/axios";
import { useAppDispatch } from "../app/hook";
import { setAllRooms } from "../features/room/room.slice";
import { AxiosError } from "axios";

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
      try {
        const response = await api.get("/room/get-all-rooms");
        const parsedResponse = UseGetRoomResponseSchema.parse(
          response.data
        );
        dispatch(setAllRooms(parsedResponse.data));

        return parsedResponse;
      } catch (error) {
        let errorMessage = "Something went wrong while fetching rooms";
        if (error instanceof AxiosError) {
          errorMessage =
            error.response?.data.message || error.message || errorMessage;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        throw error;
      }
    },

    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};
