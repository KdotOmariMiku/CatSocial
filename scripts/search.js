const cats = [
  {
    name: 'Miu',
    image: './assets/cat-miu.jpg',
    location: '0.8 km',
    age: '3 tuổi',
    desc: 'Mèo tam thể siêu thân thiện, thích chơi bóng và ngủ gọn trong ôm.',
    tags: ['siêu thân thiện', 'người lớn', 'năng động']
  },
  {
    name: 'Luna',
    image: './assets/cat-luna.jpg',
    location: '1.2 km',
    age: '2 tuổi',
    desc: 'Mèo xám lông mượt, thích ăn cá và mắc kẹt trong chăn.',
    tags: ['dịu dàng', 'ngọt ngào', 'ăn cá']
  },
  {
    name: 'Simba',
    image: './assets/cat-simba.jpg',
    location: '3.0 km',
    age: '4 tuổi',
    desc: 'Chú mèo cool ngầu, thích chụp ảnh và chạy vòng quanh phòng.',
    tags: ['cool', 'năng động', 'tinh nghịch']
  },
  {
    name: 'Tí',
    image: './assets/cat-ti.jpg',
    location: '0.6 km',
    age: '1 tuổi',
    desc: 'Mèo con hiếu động, rất thích được vuốt ve và chơi dây.',
    tags: ['bé nhỏ', 'hiếu động', 'thích vuốt ve']
  },
  {
    name: 'Mít',
    image: './assets/cat-mit.jpg',
    location: '2.4 km',
    age: '3 tuổi',
    desc: 'Mèo vàng hiền lành, mê ngủ và luôn ngoan ngoãn.',
    tags: ['ngoan', 'mê ngủ', 'dễ thương']
  }
];

const results = document.getElementById('searchResults');
const input = document.getElementById('searchInput');
const count = document.getElementById('resultCount');
const button = document.getElementById('searchButton');

function showProfile(cat) {
  const dialog = document.createElement('dialog');
  dialog.className = 'profile-dialog';

  const heading = document.createElement('h2');
  heading.textContent = cat.name;

  const description = document.createElement('p');
  description.textContent = cat.desc;

  const details = document.createElement('p');
  details.textContent = `${cat.age} · ${cat.location}`;

  const tags = document.createElement('p');
  tags.textContent = `Tính cách: ${cat.tags.join(', ')}`;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'btn secondary-btn';
  closeButton.textContent = 'Đóng';
  closeButton.addEventListener('click', () => dialog.close());

  const loginLink = document.createElement('a');
  loginLink.className = 'btn primary-btn';
  loginLink.href = './login.html';
  loginLink.textContent = 'Đăng nhập để kết nối';

  const actions = document.createElement('div');
  actions.className = 'search-card-actions';
  actions.append(closeButton, loginLink);
  dialog.append(heading, description, details, tags, actions);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.appendChild(dialog);
  dialog.showModal();
}

function createCard(cat) {
  const card = document.createElement('article');
  card.className = 'search-card';

  const img = document.createElement('img');
  img.src = cat.image;
  img.alt = cat.name;
  card.appendChild(img);

  const body = document.createElement('div');
  body.className = 'search-card-body';

  const heading = document.createElement('h3');
  heading.textContent = cat.name;

  const description = document.createElement('p');
  description.textContent = cat.desc;

  const metadata = document.createElement('div');
  metadata.className = 'search-card-meta';
  const age = document.createElement('span');
  age.textContent = cat.age;
  const location = document.createElement('span');
  location.textContent = cat.location;
  metadata.append(age, location);

  const actions = document.createElement('div');
  actions.className = 'search-card-actions';

  const profileButton = document.createElement('button');
  profileButton.type = 'button';
  profileButton.className = 'btn secondary-btn';
  profileButton.textContent = 'Xem profile';
  profileButton.addEventListener('click', () => showProfile(cat));

  const connectLink = document.createElement('a');
  connectLink.className = 'btn primary-btn';
  connectLink.href = './login.html';
  connectLink.textContent = 'Gặp ngay';

  actions.append(profileButton, connectLink);
  body.append(heading, description, metadata, actions);

  card.appendChild(body);
  return card;
}

function renderResults(list) {
  results.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Không tìm thấy boss nào với từ khóa này. Hãy thử từ khóa khác nhé!';
    results.appendChild(empty);
    count.textContent = '0';
    return;
  }

  count.textContent = list.length;
  list.forEach(cat => results.appendChild(createCard(cat)));
}

function filterResults() {
  const term = input.value.trim().toLowerCase();
  if (!term) {
    renderResults(cats);
    return;
  }

  const filtered = cats.filter(cat => {
    return [cat.name, cat.desc, cat.age, cat.location, ...cat.tags]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  renderResults(filtered);
}

button.addEventListener('click', filterResults);
input.addEventListener('input', filterResults);

document.addEventListener('DOMContentLoaded', () => {
  renderResults(cats);
});
