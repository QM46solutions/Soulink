// Soul Shop product views, taken from the product turntable videos in Downloads (Nov 2026).
// Frames go evenly from the front round one side (the videos do not show the other side):
// jacket and hoodie turn front -> back (180°); the sneaker turns front (toe) -> side.
// jacket: Jacket.MP4 (1080p), frames 1-116. hoodie: first Hoddie video, frames 1-129.
// sneaker: Sneakers.MP4 (1080p), frames 1-138 (stops before the heel tab, whose text the video misspells).
// Regenerate rather than editing by hand.
/* eslint-disable global-require */
const SHOP3D = {
  jacket: {
    aspect: 1047 / 720, // height / width of each frame
    loop: false, // 180°: front to back only
    span: '180°', ends: ['FRONT', 'BACK'],
    rows: [
      [require('../../assets/shop3d/jacket/f00.webp'), require('../../assets/shop3d/jacket/f01.webp'), require('../../assets/shop3d/jacket/f02.webp'), require('../../assets/shop3d/jacket/f03.webp'), require('../../assets/shop3d/jacket/f04.webp'), require('../../assets/shop3d/jacket/f05.webp'), require('../../assets/shop3d/jacket/f06.webp'), require('../../assets/shop3d/jacket/f07.webp'), require('../../assets/shop3d/jacket/f08.webp'), require('../../assets/shop3d/jacket/f09.webp'), require('../../assets/shop3d/jacket/f10.webp'), require('../../assets/shop3d/jacket/f11.webp'), require('../../assets/shop3d/jacket/f12.webp'), require('../../assets/shop3d/jacket/f13.webp'), require('../../assets/shop3d/jacket/f14.webp'), require('../../assets/shop3d/jacket/f15.webp'), require('../../assets/shop3d/jacket/f16.webp'), require('../../assets/shop3d/jacket/f17.webp'), require('../../assets/shop3d/jacket/f18.webp'), require('../../assets/shop3d/jacket/f19.webp'), require('../../assets/shop3d/jacket/f20.webp'), require('../../assets/shop3d/jacket/f21.webp'), require('../../assets/shop3d/jacket/f22.webp'), require('../../assets/shop3d/jacket/f23.webp'), require('../../assets/shop3d/jacket/f24.webp'), require('../../assets/shop3d/jacket/f25.webp'), require('../../assets/shop3d/jacket/f26.webp'), require('../../assets/shop3d/jacket/f27.webp'), require('../../assets/shop3d/jacket/f28.webp'), require('../../assets/shop3d/jacket/f29.webp'), require('../../assets/shop3d/jacket/f30.webp'), require('../../assets/shop3d/jacket/f31.webp'), require('../../assets/shop3d/jacket/f32.webp'), require('../../assets/shop3d/jacket/f33.webp'), require('../../assets/shop3d/jacket/f34.webp'), require('../../assets/shop3d/jacket/f35.webp'), require('../../assets/shop3d/jacket/f36.webp'), require('../../assets/shop3d/jacket/f37.webp'), require('../../assets/shop3d/jacket/f38.webp'), require('../../assets/shop3d/jacket/f39.webp')],
    ],
    poster: require('../../assets/shop3d/jacket/f00.webp'),
  },
  hoodie: {
    aspect: 753 / 480,
    loop: false, // 180°: front to back only
    span: '180°', ends: ['FRONT', 'BACK'],
    rows: [
      [require('../../assets/shop3d/hoodie/f00.webp'), require('../../assets/shop3d/hoodie/f01.webp'), require('../../assets/shop3d/hoodie/f02.webp'), require('../../assets/shop3d/hoodie/f03.webp'), require('../../assets/shop3d/hoodie/f04.webp'), require('../../assets/shop3d/hoodie/f05.webp'), require('../../assets/shop3d/hoodie/f06.webp'), require('../../assets/shop3d/hoodie/f07.webp'), require('../../assets/shop3d/hoodie/f08.webp'), require('../../assets/shop3d/hoodie/f09.webp'), require('../../assets/shop3d/hoodie/f10.webp'), require('../../assets/shop3d/hoodie/f11.webp'), require('../../assets/shop3d/hoodie/f12.webp'), require('../../assets/shop3d/hoodie/f13.webp'), require('../../assets/shop3d/hoodie/f14.webp'), require('../../assets/shop3d/hoodie/f15.webp'), require('../../assets/shop3d/hoodie/f16.webp'), require('../../assets/shop3d/hoodie/f17.webp'), require('../../assets/shop3d/hoodie/f18.webp'), require('../../assets/shop3d/hoodie/f19.webp'), require('../../assets/shop3d/hoodie/f20.webp'), require('../../assets/shop3d/hoodie/f21.webp'), require('../../assets/shop3d/hoodie/f22.webp'), require('../../assets/shop3d/hoodie/f23.webp'), require('../../assets/shop3d/hoodie/f24.webp'), require('../../assets/shop3d/hoodie/f25.webp'), require('../../assets/shop3d/hoodie/f26.webp'), require('../../assets/shop3d/hoodie/f27.webp'), require('../../assets/shop3d/hoodie/f28.webp'), require('../../assets/shop3d/hoodie/f29.webp'), require('../../assets/shop3d/hoodie/f30.webp'), require('../../assets/shop3d/hoodie/f31.webp'), require('../../assets/shop3d/hoodie/f32.webp')],
    ],
    poster: require('../../assets/shop3d/hoodie/f00.webp'),
  },
  sneaker: {
    aspect: 667 / 720,
    loop: false, // front (toe) to side only
    span: null, ends: ['FRONT', 'SIDE'],
    rows: [
      [require('../../assets/shop3d/sneaker/f00.webp'), require('../../assets/shop3d/sneaker/f01.webp'), require('../../assets/shop3d/sneaker/f02.webp'), require('../../assets/shop3d/sneaker/f03.webp'), require('../../assets/shop3d/sneaker/f04.webp'), require('../../assets/shop3d/sneaker/f05.webp'), require('../../assets/shop3d/sneaker/f06.webp'), require('../../assets/shop3d/sneaker/f07.webp'), require('../../assets/shop3d/sneaker/f08.webp'), require('../../assets/shop3d/sneaker/f09.webp'), require('../../assets/shop3d/sneaker/f10.webp'), require('../../assets/shop3d/sneaker/f11.webp'), require('../../assets/shop3d/sneaker/f12.webp'), require('../../assets/shop3d/sneaker/f13.webp'), require('../../assets/shop3d/sneaker/f14.webp'), require('../../assets/shop3d/sneaker/f15.webp'), require('../../assets/shop3d/sneaker/f16.webp'), require('../../assets/shop3d/sneaker/f17.webp'), require('../../assets/shop3d/sneaker/f18.webp'), require('../../assets/shop3d/sneaker/f19.webp'), require('../../assets/shop3d/sneaker/f20.webp'), require('../../assets/shop3d/sneaker/f21.webp'), require('../../assets/shop3d/sneaker/f22.webp'), require('../../assets/shop3d/sneaker/f23.webp'), require('../../assets/shop3d/sneaker/f24.webp'), require('../../assets/shop3d/sneaker/f25.webp'), require('../../assets/shop3d/sneaker/f26.webp'), require('../../assets/shop3d/sneaker/f27.webp'), require('../../assets/shop3d/sneaker/f28.webp'), require('../../assets/shop3d/sneaker/f29.webp'), require('../../assets/shop3d/sneaker/f30.webp'), require('../../assets/shop3d/sneaker/f31.webp'), require('../../assets/shop3d/sneaker/f32.webp'), require('../../assets/shop3d/sneaker/f33.webp'), require('../../assets/shop3d/sneaker/f34.webp'), require('../../assets/shop3d/sneaker/f35.webp')],
    ],
    poster: require('../../assets/shop3d/sneaker/f00.webp'),
  },
};

export default SHOP3D;
