import { useEffect } from "react";
import { useAppSelector } from "../app/hook";
import { Outlet, useNavigate } from "react-router-dom";
import LoadingBar from "../component/ui/LoadingBar";

function PrivateRoutes() {
  const { isAuthenticated, isLive, isAuthLoading, userInfo, isJoined } =
    useAppSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/", { replace: true });
    } else if (isLive && isAuthenticated) {
      navigate(`/room/${userInfo?.rooms[0]}`, { replace: true });
    } else if (isJoined.status && isAuthenticated) {
      navigate(`/room/${isJoined.roomId}`, { replace: true });
    } else if (isAuthenticated) {
      navigate("/room", { replace: true });
    }
  }, [isAuthenticated, isLive, isJoined.status]);

  if (isAuthLoading) {
    return (
      <div className="h-dvh w-full flex items-center justify-center dark:bg-background_dark bg-background_light ">
        <LoadingBar />
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : null;
}
export default PrivateRoutes;
