import { useState } from "react";
import { FaYoutube } from "react-icons/fa6";
import { AnimatePresence } from "motion/react";
import CreateStreamDialog from "./ui/CreateStreamDialog";
import { useWebSocketContext } from "../contexts/webSocketProvider";
import { showToast } from "../utils/showToast";
import { useAppSelector } from "../app/hook";
import { selectUserInfo } from "../features/auth/auth.slice";
import { useLoadingContext } from "../contexts/loadingActionProvider";

function CreateRoomSection() {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const { startLoading } = useLoadingContext();
  const loggedInUser = useAppSelector(selectUserInfo);
  const [roomType, setRoomType] = useState<"youtube" | "soundcloud">();
  const { sendMessage, isConnected } = useWebSocketContext();

  const providers = [
    { name: "youtube", icon: <FaYoutube size={30} color="#F70000" /> },
  ];

  const handleCreateRoom = (roomName: string, roomPassword: string) => {
    if (roomType === "soundcloud") {
      showToast("emoji", "Comming soon!");
    }

    const createRoomData = {
      userId: loggedInUser?._id,
      roomType,
      roomName,
      roomPassword,
    };

    startLoading("createRoom");

    const sent = sendMessage(createRoomData, "CREATE_ROOM");

    if (sent) {
      return;
    } else if (isConnected) {
      console.warn(
        "Failed to send message even though connection is established"
      );
    } else {
      showToast("error", "Something went wrong! Try again.");
    }
  };

  return (
    <div className="flex flex-col gap-5 lg:flex-1   ">
      <AnimatePresence>
        {isModalOpen && (
          <CreateStreamDialog
            setIsOpen={setIsModalOpen}
            handleCreateRoom={handleCreateRoom}
          />
        )}
      </AnimatePresence>
      <h1 className="sm:text-xl text-base font-semibold  ">
        Choose a provider to create a stream
      </h1>
      <div className="grid xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-3 grid-cols-2 gap-3">
        {providers.map((provider) => (
          <button
            onClick={() => {
              setIsModalOpen((prev) => !prev);
              setRoomType(provider.name as "youtube" | "soundcloud");
            }}
            key={provider.name}
            className="flex    dark:bg-background_blue flex-col rounded-lg  items-center  p-4 sm:p-10 hover:rounded-none transition-all duration-300 bg-background_light_secondary"
          >
            <h3 className="md:text-base dark:text-text_dark text-text_light text-sm capitalize">
              {provider.name}
            </h3>
            {provider.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CreateRoomSection;
