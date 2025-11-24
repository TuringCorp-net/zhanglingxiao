/* PDF Viewer controller */
(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // 配置 pdf.js Worker 为同域自托管路径
  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/libs/pdfjs/pdf.worker.min.js';
  }

  const params = new URLSearchParams(window.location.search);
  const key = params.get('key');
  const canvas = document.getElementById('pdfCanvas');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const pageIndicator = document.getElementById('pageIndicator');

  if (!key) {
    console.error('Missing key parameter');
    if (pageIndicator) pageIndicator.textContent = '缺少 key 参数';
    return;
  }

  const url = `/works/file/${encodeURIComponent(key)}`;

  let pdfDoc = null;
  let currentPage = 1;
  let scale = 1.25;

  const renderPage = async (num) => {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = { canvasContext: context, viewport };
    await page.render(renderContext).promise;

    if (pageIndicator) pageIndicator.textContent = `第 ${num} / ${pdfDoc.numPages} 页`;
  };

  const queueRenderPage = (num) => {
    currentPage = Math.min(Math.max(num, 1), pdfDoc.numPages);
    renderPage(currentPage);
  };

  const onPrevPage = () => queueRenderPage(currentPage - 1);
  const onNextPage = () => queueRenderPage(currentPage + 1);

  const onZoomIn = () => { scale = Math.min(scale + 0.1, 3); queueRenderPage(currentPage); };
  const onZoomOut = () => { scale = Math.max(scale - 0.1, 0.5); queueRenderPage(currentPage); };

  zoomInBtn && zoomInBtn.addEventListener('click', onZoomIn);
  zoomOutBtn && zoomOutBtn.addEventListener('click', onZoomOut);
  prevBtn && prevBtn.addEventListener('click', onPrevPage);
  nextBtn && nextBtn.addEventListener('click', onNextPage);

  // 加载并渲染 PDF
  window.pdfjsLib.getDocument(url).promise
    .then((doc) => {
      pdfDoc = doc;
      currentPage = 1;
      renderPage(currentPage);
    })
    .catch((err) => {
      console.error('Failed to load PDF:', err);
      if (pageIndicator) pageIndicator.textContent = 'PDF 加载失败';
    });
})();