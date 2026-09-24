import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { fetchReportingTree } from "../../store/slices/reportingSlice";
import { ReportingTree } from "../../components/components/reporting-tree";

const ReportingPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { treeData, loading, error } = useAppSelector((state) => state.reporting);

  useEffect(() => {
    dispatch(fetchReportingTree());
  }, [dispatch]);

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-crmText">Reporting and Deactivate</h1>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-crmBorder p-6 overflow-x-auto min-h-[500px]">
        <ReportingTree
          data={treeData as any}
          isLoading={loading}
          error={error}
        />
      </div>
    </div>
  );
};

export default ReportingPage;
