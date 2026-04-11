import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import ArchitectureMap from "@/components/admin/ArchitectureMap";

const ArchitectureMapPage = () => {
  const { user } = useAuth();
  const { isAdmin, isViewer, loading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Chargement…</div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0B0F19] p-4 md:p-8">
      <ArchitectureMap />
    </div>
  );
};

export default ArchitectureMapPage;
