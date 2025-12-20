/**
 * File: src/app/threejs-template/utils/loaders.ts
 * Description: Model, texture, and HDR environment loader utilities tailored for
 *              Drei/Three workflows so agents can drop assets in quickly.
 */
"use client";

import { useGLTF, useTexture, useCubeTexture } from "@react-three/drei";
import { GLTF } from "three-stdlib";
import { CubeTexture, Texture, TextureLoader } from "three";
import { useMemo } from "react";

export type LoadedModel<T extends object = GLTF> = T & {
  url: string;
};

export function useModel<T extends object = GLTF>(url: string): LoadedModel<T> {
  const model = useGLTF(url) as T;
  return useMemo(
    () =>
      Object.assign(model, {
        url,
      }) as LoadedModel<T>,
    [model, url],
  );
}

export function useTextureSet<T extends Record<string, string>>(sources: T) {
  const textures = useTexture(sources);
  return textures as Record<keyof T, Texture>;
}

export function useHDRI(paths: string[], pathPrefix = ""): CubeTexture {
  return useCubeTexture(paths, { path: pathPrefix });
}

export async function loadTexture(url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    new TextureLoader().load(
      url,
      (texture) => {
        resolve(texture);
      },
      undefined,
      (error) => reject(error),
    );
  });
}

export async function loadModelAsync<T extends object = GLTF>(url: string): Promise<LoadedModel<T>> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        const result = gltf as unknown as LoadedModel<T>;
        result.url = url;
        resolve(result);
      },
      undefined,
      (error) => reject(error),
    );
  });
}

export function releaseModelCache(url: string) {
  useGLTF.clear(url);
}
