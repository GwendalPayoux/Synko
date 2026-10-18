import { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  Download,
  History,
  Info,
  MessageSquare,
  ShieldCheck,
  FileText,
  Upload,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { api, type Document, type Project, type User, type Version } from './domain';
import { DocumentDetails, type Folder } from './modules';
export const fileSize = (n: number) =>
  n < 1024
    ? `${n} o`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} Ko`
      : `${(n / 1048576).toFixed(1)} Mo`;
type Section = 'info' | 'versions' | 'approvals' | 'comments';
export function DocumentViewer({
  document: doc,
  project,
  user,
  folders,
  initialTab,
  onClose,
  onChanged,
  onError,
  onUpload,
  busy,
}: {
  document: Document;
  project: Project;
  user: User;
  folders: Folder[];
  initialTab: Section;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (s: string) => void;
  onUpload: () => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState<Section>(initialTab),
    [versions, setVersions] = useState<Version[]>([]),
    [versionId, setVersionId] = useState(''),
    [text, setText] = useState<string | null>(null),
    [previewError, setPreviewError] = useState(''),
    [previewBusy, setPreviewBusy] = useState(true),
    [restore, setRestore] = useState<Version | null>(null),
    [restoring, setRestoring] = useState(false),
    [refresh, setRefresh] = useState(0),
    [technical, setTechnical] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    previous = useRef<HTMLElement | null>(null),
    panel = useRef<HTMLDivElement>(null);
  const base = `/projects/${project.id}/documents/${doc.id}`,
    write =
      user.role === 'org_admin' ||
      (user.role === 'project_manager' && project.owner_id === user.id);
  const current = versions[0],
    selected = versions.find((v) => v.id === versionId) || current;
  const download = '/api' + base + `/versions/${selected?.id || doc.version_id}`;
  const isText = /\.(txt|md|csv|json|log)$/i.test(doc.name),
    isImage = /\.(png|jpe?g|webp)$/i.test(doc.name),
    isPdf = /\.pdf$/i.test(doc.name);
  const previewUrl =
    '/api' +
    base +
    `/preview?format=raw&version_id=${encodeURIComponent(selected?.id || doc.version_id)}`;
  async function loadVersions() {
    setVersions(await api<Version[]>(base + '/versions'));
  }
  async function changed() {
    await onChanged();
    await loadVersions();
    setRefresh((n) => n + 1);
  }
  useEffect(() => {
    previous.current = window.document.activeElement as HTMLElement;
    heading.current?.focus();
    return () => previous.current?.focus();
  }, []);
  useEffect(() => {
    loadVersions().catch((e) => onError(e.message));
  }, [doc.id, doc.version_id, doc.version]);
  useEffect(() => {
    panel.current?.scrollTo(0, 0);
  }, [tab]);
  useEffect(() => {
    const controller = new AbortController();
    setText(null);
    setPreviewError('');
    setPreviewBusy(true);
    if (!isText) {
      setPreviewBusy(false);
      return () => controller.abort();
    }
    fetch(
      '/api' + base + `/preview?version_id=${encodeURIComponent(selected?.id || doc.version_id)}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error);
        return value;
      })
      .then((v) => setText(v.content))
      .catch((e) => {
        if (e.name !== 'AbortError') setPreviewError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewBusy(false);
      });
    return () => controller.abort();
  }, [doc.id, doc.name, selected?.id, refresh]);
  async function restoreVersion() {
    if (!restore) return;
    setRestoring(true);
    try {
      await api(base + '/restore', 'POST', { version_id: restore.id });
      setVersionId('');
      setRestore(null);
      await changed();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setRestoring(false);
    }
  }
  return (
    <section className="document-workspace" aria-label="Consultation du document">
      <header className="document-workspace-header">
        <button className="secondary" onClick={onClose} aria-label="Fermer">
          <ArrowLeft size={16} />
          Documents
        </button>
        <div>
          <span className="eyebrow">{project.name}</span>
          <h2 ref={heading} tabIndex={-1}>
            {doc.name}
          </h2>
        </div>
        <div className="document-header-actions">
          {user.permissions.includes('document:write') && (
            <button className="secondary" disabled={busy} onClick={onUpload}>
              <Upload size={16} />
              {busy ? 'Import…' : 'Nouvelle version'}
            </button>
          )}
          <a className="primary" href={download}>
            <Download size={16} />
            Télécharger
          </a>
        </div>
      </header>
      <div className="document-workspace-grid">
        <section className="document-preview" aria-label="Aperçu du document">
          <div className="document-preview-toolbar">
            <span>
              <FileText size={16} />
              Aperçu
            </span>
            <div>
              <span className="version-badge">Version {selected?.version || doc.version}</span>
              <span>{fileSize(selected?.size || doc.size)}</span>
            </div>
          </div>
          <div className="document-preview-content">
            {isText ? (
              previewBusy ? (
                <p role="status">Chargement de l’aperçu…</p>
              ) : previewError ? (
                <div className="preview-unavailable">
                  <FileText size={38} />
                  <h3>Aperçu indisponible</h3>
                  <p>{previewError}</p>
                  <a className="secondary" href={download}>
                    Télécharger le fichier
                  </a>
                </div>
              ) : (
                <pre className="document-text">{text}</pre>
              )
            ) : isImage ? (
              <img
                src={previewUrl}
                alt={doc.name}
                onError={() => setPreviewError('Le fichier image ne peut pas être affiché.')}
              />
            ) : isPdf ? (
              <>
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title={'Aperçu PDF · ' + doc.name}
                  sandbox="allow-same-origin"
                />
                <p className="pdf-fallback">
                  Si votre navigateur ne prend pas en charge l’aperçu PDF,{' '}
                  <a className="link" href={download}>
                    téléchargez le document
                  </a>
                  .
                </p>
              </>
            ) : (
              <div className="preview-unavailable">
                <FileText size={42} />
                <h3>Ce format se consulte après téléchargement</h3>
                <p>
                  L’aperçu intégré prend en charge les fichiers texte, PDF et les images PNG, JPEG
                  et WebP.
                </p>
                <a className="secondary" href={download}>
                  <Download size={16} />
                  Télécharger le document
                </a>
              </div>
            )}
            {!isText && previewError && (
              <p className="error" role="alert">
                {previewError}
              </p>
            )}
          </div>
          <footer>
            {selected && current && selected.id !== current.id ? (
              <span>Vous consultez une ancienne version · v{selected.version}</span>
            ) : (
              <span>Version courante · conservée dans votre espace projet</span>
            )}
          </footer>
        </section>
        <aside className="document-inspector panel">
          <nav className="document-inspector-tabs" aria-label="Onglets du document">
            {[
              { id: 'info', label: 'Informations', icon: Info },
              { id: 'versions', label: 'Versions', icon: History },
              { id: 'approvals', label: 'Validations', icon: ShieldCheck },
              { id: 'comments', label: 'Commentaires', icon: MessageSquare },
            ].map((t) => (
              <button
                key={t.id}
                aria-current={tab === t.id ? 'page' : undefined}
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id as Section)}
              >
                <t.icon size={16} />
                {t.label}
                {t.id === 'versions' && <small>{versions.length}</small>}
              </button>
            ))}
          </nav>
          <div className="document-inspector-content" ref={panel}>
            {tab === 'versions' ? (
              <>
                <div className="inspector-intro">
                  <h3>Historique des versions</h3>
                  <p>Consultez une version antérieure ou restaurez-la sans perdre les suivantes.</p>
                </div>
                <div className="document-versions">
                  {versions.map((v) => (
                    <article className={selected?.id === v.id ? 'selected' : ''} key={v.id}>
                      <div className="version-title">
                        <strong>Version {v.version}</strong>
                        {v.id === current?.id && <span className="version-current">Courante</span>}
                      </div>
                      <p>{new Date(v.created_at).toLocaleString('fr-FR')}</p>
                      <span>{fileSize(v.size)}</span>
                      <div className="version-actions">
                        <button
                          className="secondary"
                          aria-label={'Consulter la version ' + v.version}
                          onClick={() => setVersionId(v.id)}
                        >
                          Consulter
                        </button>
                        <a
                          className="icon-button"
                          aria-label={'Télécharger la version ' + v.version}
                          href={'/api' + base + `/versions/${v.id}`}
                        >
                          <Download size={16} />
                        </a>
                        {write && v.id !== current?.id && (
                          <button
                            className="icon-button"
                            aria-label={'Restaurer la version ' + v.version}
                            onClick={() => setRestore(v)}
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        <button
                          className="icon-button"
                          aria-label={'Métadonnées de la version ' + v.version}
                          onClick={() => setTechnical(technical === v.id ? null : v.id)}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      {technical === v.id && (
                        <div className="version-technical">
                          <span>Empreinte SHA-256</span>
                          <code>{v.sha256}</code>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {restore && (
                  <div className="confirm">
                    <h3>Restaurer la version {restore.version} ?</h3>
                    <p>
                      Une nouvelle version sera créée. Les versions existantes seront conservées.
                    </p>
                    <button
                      className="secondary"
                      disabled={restoring}
                      onClick={() => setRestore(null)}
                    >
                      Annuler
                    </button>
                    <button className="primary" disabled={restoring} onClick={restoreVersion}>
                      Confirmer la restauration
                    </button>
                  </div>
                )}
              </>
            ) : (
              <DocumentDetails
                key={doc.id + ':' + refresh}
                documentId={doc.id}
                project={project}
                user={user}
                folders={folders}
                section={tab}
                onError={onError}
                onChanged={changed}
              />
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
