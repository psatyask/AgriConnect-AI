import { expect, test } from 'vitest'
import { IN } from '../regions/in'
import { US } from '../regions/us'
import { kgPerPackage } from '../utils/units'

const LB = 0.45359237
const lb = (n: number) => n * LB

test('reads a weight only when the package name states exactly one', () => {
  expect(kgPerPackage('25 lb cartons loose', US)).toBeCloseTo(lb(25))
  expect(kgPerPackage('10 lb cartons', US)).toBeCloseTo(lb(10))
  expect(kgPerPackage('50 lb sacks', US)).toBeCloseTo(lb(50))
  expect(kgPerPackage('25-lb sacks', US)).toBeCloseTo(lb(25))
  expect(kgPerPackage('1.5 lbs bags', US)).toBeCloseTo(lb(1.5))
  expect(kgPerPackage('50 kg bags', US)).toBe(50)
  expect(kgPerPackage('5 kg/11 lb flats', US)).toBeCloseTo(lb(11))  // the stated pound weight wins
})

test('never guesses: counts, ranges, volumes and weightless packages stay unknown', () => {
  for (const name of ['cartons 2 layer', 'cartons', 'flats 12 1-pint cups', '12 6-oz cups', '40-50 lb cartons', '2 5 lb bags', '12 x 5 lb bags', '1 1/9 bushel cartons', 'bins', '0 lb sacks'])
    expect(kgPerPackage(name, US, 'tomato'), name).toBeNull()
})

test('plain units and the region packs: lb, kg, cwt, quintal, and a bushel only for commodities with a known weight', () => {
  expect(kgPerPackage('lb', US)).toBeCloseTo(LB)
  expect(kgPerPackage('cwt', US)).toBeCloseTo(lb(100))
  expect(kgPerPackage('quintal', IN)).toBe(100)
  expect(kgPerPackage('bushel', US, 'corn')).toBeCloseTo(lb(56))
  expect(kgPerPackage('bushel', US, 'wheat')).toBeCloseTo(lb(60))
  expect(kgPerPackage('bushel', US, 'tomato')).toBeNull()  // no standard bushel weight in the pack: not guessed
})
