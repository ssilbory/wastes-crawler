const canvas = document.querySelector<HTMLCanvasElement>('#view');
const ctx = canvas?.getContext('2d');

if (canvas && ctx) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
