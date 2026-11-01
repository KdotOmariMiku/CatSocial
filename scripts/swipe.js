function attachStampsToCards(deck) {
  deck.querySelectorAll('.swipe-card').forEach(card => {
    if (card.querySelector('.stamp.like')) return;

    const stampLike = document.createElement('div');
    stampLike.className = 'stamp like';
    stampLike.textContent = 'THÍCH';

    const stampNope = document.createElement('div');
    stampNope.className = 'stamp nope';
    stampNope.textContent = 'BỎ QUA';

    card.appendChild(stampLike);
    card.appendChild(stampNope);
  });
}

function showEmpty(deck) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = 'Hết profile rồi — quay lại sau nhé!';
  deck.appendChild(empty);
}

function initDeck() {
  const deck = document.querySelector('.card-deck');
  if (!deck) return;

  const passBtn = document.querySelector('#pass-btn');
  const likeBtn = document.querySelector('#like-btn');

  attachStampsToCards(deck);
  deck.style.touchAction = 'none';

  function removeTop(direction) {
    const cards = deck.querySelectorAll('.swipe-card');
    if (!cards.length) return;

    const top = cards[0];
    top.style.transition = 'transform 300ms ease, opacity 300ms ease';
    const offsetX = direction === 'left' ? -window.innerWidth : window.innerWidth;
    const rotate = direction === 'left' ? -20 : 20;
    top.style.transform = `translate(${offsetX}px, -20px) rotate(${rotate}deg) scale(0.95)`;
    top.style.opacity = '0';

    setTimeout(() => {
      top.remove();
      if (deck.querySelectorAll('.swipe-card').length === 0) {
        showEmpty(deck);
      }
    }, 350);
  }

  if (passBtn) passBtn.addEventListener('click', () => removeTop('left'));
  if (likeBtn) likeBtn.addEventListener('click', () => removeTop('right'));

  let activeCard = null;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;

  function pointerDownHandler(e) {
    const top = deck.querySelector('.swipe-card');
    if (!top) return;
    if (e.target.closest('.swipe-card') !== top) return;

    activeCard = top;
    startX = e.clientX;
    startY = e.clientY;
    currentX = 0;
    currentY = 0;
    activeCard.style.transition = 'none';

    if (activeCard.setPointerCapture) {
      try {
        activeCard.setPointerCapture(e.pointerId);
      } catch (error) {
        // ignore
      }
    }
  }

  function pointerMoveHandler(e) {
    if (!activeCard) return;

    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    const rotate = currentX / 12;
    activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;

    const likeStamp = activeCard.querySelector('.stamp.like');
    const nopeStamp = activeCard.querySelector('.stamp.nope');
    const intensity = Math.min(Math.abs(currentX) / 120, 1);

    if (currentX > 0) {
      if (likeStamp) {
        likeStamp.style.opacity = intensity;
        likeStamp.style.transform = `scale(${0.9 + intensity * 0.2})`;
      }
      if (nopeStamp) nopeStamp.style.opacity = 0;
    } else if (currentX < 0) {
      if (nopeStamp) {
        nopeStamp.style.opacity = intensity;
        nopeStamp.style.transform = `scale(${0.9 + intensity * 0.2})`;
      }
      if (likeStamp) likeStamp.style.opacity = 0;
    } else {
      if (likeStamp) likeStamp.style.opacity = 0;
      if (nopeStamp) nopeStamp.style.opacity = 0;
    }
  }

  function pointerUpHandler() {
    if (!activeCard) return;

    const threshold = 120;
    if (Math.abs(currentX) > threshold) {
      const direction = currentX > 0 ? 'right' : 'left';
      removeTop(direction);
    } else {
      activeCard.style.transition = 'transform 250ms ease';
      activeCard.style.transform = 'translate(0,0) rotate(0deg)';
    }

    const likeStamp = activeCard.querySelector('.stamp.like');
    const nopeStamp = activeCard.querySelector('.stamp.nope');
    if (likeStamp) likeStamp.style.opacity = 0;
    if (nopeStamp) nopeStamp.style.opacity = 0;

    try {
      activeCard.releasePointerCapture && activeCard.releasePointerCapture(activeCard.pointerId);
    } catch (error) {
      // ignore
    }

    activeCard = null;
  }

  deck.addEventListener('pointerdown', pointerDownHandler);
  window.addEventListener('pointermove', pointerMoveHandler);
  window.addEventListener('pointerup', pointerUpHandler);
}

document.addEventListener('DOMContentLoaded', initDeck);
