import "source-map-support/register";

export async function flaky(event) {

  const up = new Error("Boom");
  if (event.bomb || failRandomly()) {
    throw up;
  }

  return {};

}

function failRandomly() {
  // otherwise, fail randomly, 1 in 10
  return random(0, 10) === 10;
}
// min and max included
function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
