"use client";

import Link from "next/link";
import { useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import { collegesApi } from "../../../lib/api/colleges";
import { IconPlus } from "../../../components/icons";

export default function CollegesPage() {
  const { colleges, selectedId, selectCollege, refresh, loading, error } =
    useColleges();
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  async function onClaim() {
    setClaimMsg(null);
    setClaimBusy(true);
    try {
      const { claimed } = await collegesApi.claimOrphans();
      await refresh();
      setClaimMsg(
        claimed > 0
          ? `Recovered ${claimed} legacy ${
              claimed === 1 ? "college" : "colleges"
            }.`
          : "No legacy colleges were found."
      );
    } catch (e) {
      setClaimMsg((e as Error).message);
    } finally {
      setClaimBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Colleges</h1>
          <p className="page-subtitle">
            All colleges under your admin account.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={onClaim}
            disabled={claimBusy}
          >
            {claimBusy ? <span className="spinner" /> : "Recover legacy"}
          </button>
          <Link href="/colleges/new" className="btn btn-primary">
            <IconPlus size={14} /> Add college
          </Link>
        </div>
      </div>

      {claimMsg && <div className="alert alert-info">{claimMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-card">
        {loading && !colleges ? (
          <div className="center" style={{ padding: 60 }}>
            <span className="spinner" />
          </div>
        ) : colleges && colleges.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Address</th>
                <th style={{ textAlign: "right" }}>Buses</th>
                <th style={{ textAlign: "right" }}>Drivers</th>
                <th style={{ textAlign: "right" }}>Students</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => {
                const isActive = c._id === selectedId;
                return (
                  <tr key={c._id}>
                    <td>
                      <span className="table-name">{c.name}</span>
                      {isActive && (
                        <span className="pill pill-accent">Active</span>
                      )}
                    </td>
                    <td>{c.code}</td>
                    <td className="muted">{c.address}</td>
                    <td style={{ textAlign: "right" }}>
                      {c.actualBusCount}/{c.busCount}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {c.actualDriverCount}/{c.driverCount}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {c.actualStudentCount}
                    </td>
                    <td className="table-actions">
                      {!isActive && (
                        <button
                          type="button"
                          className="link-action"
                          onClick={() => selectCollege(c._id)}
                        >
                          Select
                        </button>
                      )}
                      <Link
                        href={`/colleges/${c._id}/edit`}
                        className="link-action"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state" style={{ border: "none" }}>
            <h3>No colleges yet</h3>
            <p>Create your first college to start managing its buses, drivers and students.</p>
            <Link href="/colleges/new" className="btn btn-primary">
              <IconPlus size={14} /> Add college
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
