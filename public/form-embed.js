(function () {
  var scripts = document.querySelectorAll('script[data-form]');
  var script = scripts[scripts.length - 1];
  if (!script) return;

  var formId = script.getAttribute('data-form');
  var targetId = script.getAttribute('data-target');
  if (!formId || !targetId) return;

  var target = document.getElementById(targetId);
  if (!target) return;

  var origin = (script.src || '').replace(/\/form-embed\.js.*$/, '') || 'https://usbg-user-portal.vercel.app';

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/f/' + formId + '?embed=1';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('allowtransparency', 'true');

  // Set width:100% BEFORE inserting so it inherits parent width correctly
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  iframe.style.overflow = 'hidden';
  iframe.style.background = 'transparent';
  iframe.style.height = '500px';
  iframe.style.transition = 'height 0.2s ease';

  // Make the target fill its parent and clip the iframe
  target.style.display = 'block';
  target.style.width = '100%';
  target.style.overflow = 'hidden';

  target.appendChild(iframe);

  // Auto-resize height when form posts its scroll height
  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return;
    if (e.data && e.data.type === 'usbg-form-height' && e.data.formId === formId) {
      iframe.style.height = e.data.height + 'px';
    }
  });
})();
