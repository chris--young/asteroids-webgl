'use strict'

class Alien extends Body {
  constructor(wireframe) {
    const model = translate(0, 0.5);
    const velocity = LA.Matrix(Array)(3)(LA.IDENTITY);

    super(model, velocity, wireframe);
  }
}
