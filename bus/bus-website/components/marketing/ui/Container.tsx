import { ReactNode } from 'react';

type ContainerProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export default function Container({ children, className = '', id }: ContainerProps) {
  return (
    <section id={id} className={`anchor-offset py-20 sm:py-24 lg:py-28 ${className}`}>
      <div className="container-x">{children}</div>
    </section>
  );
}
