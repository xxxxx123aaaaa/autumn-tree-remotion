import React from 'react';
import {Composition} from 'remotion';
import {AutumnTreeMoon} from './AutumnTreeMoon';
import {VIDEO} from './constants';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AutumnTreeMoon"
      component={AutumnTreeMoon}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};
