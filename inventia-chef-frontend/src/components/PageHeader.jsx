import React from 'react';
import './PageHeader.css';

const PageHeader = ({ kicker, title, description, children, kickerClass = '' }) => {
  return (
    <div className="global-page-hero">
      <div className="global-page-hero-copy">
        {kicker && <span className={`global-kicker ${kickerClass}`}>{kicker}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && (
        <div className="global-page-hero-action">
          {children}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
