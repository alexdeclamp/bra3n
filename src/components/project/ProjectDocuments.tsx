
import React from 'react';
import { useProjectDocuments } from '@/hooks/useProjectDocuments';
import ProjectDocumentUpload from './ProjectDocumentUpload';
import { DocumentsList } from './document/DocumentsList';
import { ContentAlert } from '@/components/ui/content-alert';

interface ProjectDocumentsProps {
  projectId: string;
}

const ProjectDocuments: React.FC<ProjectDocumentsProps> = ({ projectId }) => {
  const {
    documents,
    isLoading,
    isRefreshing,
    fetchDocuments,
    handleDocumentUploaded
  } = useProjectDocuments(projectId);

  return (
    <div className="space-y-6">
      <ContentAlert 
        message="Generate notes from your PDFs to make their content available to the project chat assistant. PDF content is not directly accessible without creating notes."
      />
      
      <ProjectDocumentUpload 
        projectId={projectId} 
        onDocumentUploaded={handleDocumentUploaded}
      />
      
      <DocumentsList
        documents={documents}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRefresh={fetchDocuments}
        projectId={projectId}
      />
    </div>
  );
};

export default ProjectDocuments;
